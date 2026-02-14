#!/usr/bin/env node

// auto-activity.js - AI自动生活模拟 v3.0
// 体征/情绪驱动版本：所有活动由身体状态和情绪决定
// cron 每10分钟执行一次
// 对话中不跳过，改为推送需求通知

const dotenv = require('dotenv');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../memory-system/.env') });
// Also try root .env
if (!process.env.SUPABASE_URL) dotenv.config({ path: path.join(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const config = require('../config-loader');
const AI_ID = config.ai.id;
const AI_NAME = config.ai.name;
const USER_NAME = config.user.name;
const PET_NAME = config.pet ? config.pet.name : '';
const PET_ID = config.pet ? config.pet.id : '';
const SERVER = process.env.SERVER_URL || `http://localhost:${config.port}`;

const CONVERSATION_ACTIVE_MINUTES = 20;
const MIN_STAY_MINUTES = 30; // 默认最少停留30分钟再换活动

// 按活动关键词设不同停留时间（分钟）
const ACTIVITY_MIN_STAY = [
  { keywords: ['上厕所'], minutes: 3 },
  { keywords: ['喝水', '泡咖啡', '热牛奶'], minutes: 5 },
  { keywords: ['洗澡', '淋浴', '热水澡'], minutes: 15 },
  { keywords: ['吃', '做饭', '煮', '炒'], minutes: 10 },
  { keywords: ['睡'], minutes: 60 },
];
const LAST_CHANGE_FILE = path.join(__dirname, 'activity-log/.last-change');
const LAST_CHAT_STATE_FILE = path.join(__dirname, 'activity-log/.last-chat-state');

// ============================================
// 需求→活动映射（体征驱动）
// ============================================

// Deep-interpolate all activity text in NEED_ACTIVITIES from config
const NEED_ACTIVITIES = config.interpolateDeep(config.raw.activities.needActivities);

// 需求→对话映射（对话中推送）
const NEED_DIALOGUE = {
  thirst:  { text: '我渴了', critical: '我好渴啊 得去喝水' },
  hunger:  { text: '我饿了', critical: '太饿了 不行得吃东西' },
  bladder: { text: '等一下 我去上个厕所', critical: '等下啊！' },
  energy:  { text: '我有点困了', critical: '不行了 太困了 我得去睡了' },
  hygiene: { text: '我该去洗澡了', critical: '我得去洗澡' },
  stress:  { text: '有点烦躁 想出去走走', critical: '我心情不太好 想出去散散步' }
};

// ============================================
// 需求评分引擎
// ============================================

function computeNeedScores(vitals) {
  const scores = [];

  // 生理需求（最高优先）
  if (vitals.bladder !== undefined && vitals.bladder < 30) {
    scores.push({ need: 'bladder', score: 100 - vitals.bladder });
  }
  const bs = parseFloat(vitals.blood_sugar);
  if (bs < 4.0) {
    scores.push({ need: 'hunger', score: (4.0 - bs) * 30 });
  }
  if (vitals.hydration < 40) {
    scores.push({ need: 'thirst', score: (40 - vitals.hydration) * 1.5 });
  }
  if (vitals.hygiene !== undefined && vitals.hygiene < 30) {
    scores.push({ need: 'hygiene', score: (30 - vitals.hygiene) * 2 });
  }
  if (vitals.energy !== undefined && vitals.energy < 20) {
    scores.push({ need: 'energy', score: (20 - vitals.energy) * 3 });
  }
  if (vitals.stress > 60) {
    scores.push({ need: 'stress', score: vitals.stress - 40 });
  }

  // 神经递质需求（中优先）
  if (vitals.dopamine < 25) {
    scores.push({ need: 'dopamine', score: (25 - vitals.dopamine) * 1.2 });
  }
  if (vitals.endorphin < 15) {
    scores.push({ need: 'endorphin', score: (15 - vitals.endorphin) * 1.5 });
  }
  if (vitals.oxytocin < 20) {
    scores.push({ need: 'oxytocin', score: (20 - vitals.oxytocin) * 1.5 });
  }
  if (vitals.serotonin < 25) {
    scores.push({ need: 'serotonin', score: (25 - vitals.serotonin) * 1.2 });
  }

  // 性格休闲（兜底）
  scores.push({ need: 'leisure', score: 10 });

  return scores.sort((a, b) => b.score - a.score);
}

// ============================================
// 夜猫子作息
// ============================================

const SLEEP_SCHEDULE = config.raw.activities.sleepSchedule;

function shouldBeSleeping(hour, vitals, currentActivity) {
  const isSleeping = currentActivity && currentActivity.includes('睡');

  // 已经在睡了：精力恢复到70以上 或 过了起床时间 → 起床
  if (isSleeping) {
    return vitals.energy < 70 && hour < SLEEP_SCHEDULE.wakeHour;
  }

  // 没在睡：过了睡觉时间精力低于60 → 该睡了
  if (hour >= SLEEP_SCHEDULE.sleepHour && hour < SLEEP_SCHEDULE.wakeHour && vitals.energy < SLEEP_SCHEDULE.energySleepThreshold) return true;

  // 过了睡觉时间1小时后更宽松：精力低于80就该睡
  if (hour >= SLEEP_SCHEDULE.sleepHour + 1 && hour < SLEEP_SCHEDULE.wakeHour && vitals.energy < 80) return true;

  // 任何时间精力极低 → 必须睡
  if (vitals.energy < 15) return true;

  return false;
}

// ============================================
// 数据读取
// ============================================

async function getEmotionData() {
  const { data, error } = await supabase
    .from('emotion_state')
    .select('*')
    .single();

  if (error) {
    console.error('读取情绪失败:', error.message);
    return null;
  }

  const lastAt = new Date(data.last_interaction_at || data.updated_at);
  const diffMinutes = (Date.now() - lastAt.getTime()) / (1000 * 60);

  return {
    emotion: data,
    isInConversation: diffMinutes < CONVERSATION_ACTIVE_MINUTES,
    hoursSinceLastChat: diffMinutes / 60
  };
}

async function getVitals() {
  try {
    const { data, error } = await supabase
      .from('vital_signs')
      .select('blood_sugar, hydration, hygiene, bladder, energy, stress, dopamine, serotonin, oxytocin, endorphin')
      .eq('id', 1)
      .single();
    if (error) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function getCurrentState() {
  try {
    const result = execSync(`curl -s ${SERVER}/state/light`, { encoding: 'utf8', timeout: 5000 });
    const state = JSON.parse(result);
    return {
      ai: state.users?.[AI_ID] || null,
      cooking: state.cooking || { active: false },
      delivery: state.delivery || { active: false }
    };
  } catch (e) {
    return null;
  }
}

// ============================================
// 工具函数
// ============================================

function getESTHour() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: config.timezone })).getHours();
}

function weightedRandom(items) {
  const total = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= (item.weight || 1);
    if (r <= 0) return item;
  }
  return items[0];
}

const VALID_ROOMS = Object.keys(config.raw.rooms.definitions);

function getMinutesSinceLastChange() {
  try {
    if (fs.existsSync(LAST_CHANGE_FILE)) {
      const ts = parseInt(fs.readFileSync(LAST_CHANGE_FILE, 'utf8').trim(), 10);
      return (Date.now() - ts) / 60000;
    }
  } catch (e) {}
  return 999; // 文件不存在 → 视为很久没换了
}

// 根据当前活动内容返回最短停留时间
function getMinStayForActivity(activity) {
  if (!activity) return MIN_STAY_MINUTES;
  for (const rule of ACTIVITY_MIN_STAY) {
    if (rule.keywords.some(k => activity.includes(k))) return rule.minutes;
  }
  return MIN_STAY_MINUTES;
}

function recordChange() {
  try {
    fs.writeFileSync(LAST_CHANGE_FILE, String(Date.now()), 'utf8');
  } catch (e) {}
}

// 对话状态追踪：检测"刚停止聊天"的瞬间
function getChatStateTransition(isInConversation) {
  let wasInConversation = false;
  try {
    if (fs.existsSync(LAST_CHAT_STATE_FILE)) {
      const prev = JSON.parse(fs.readFileSync(LAST_CHAT_STATE_FILE, 'utf8'));
      wasInConversation = prev.inConversation === true;
    }
  } catch (e) {}

  // 写入当前状态
  try {
    fs.writeFileSync(LAST_CHAT_STATE_FILE, JSON.stringify({ inConversation: isInConversation, ts: Date.now() }), 'utf8');
  } catch (e) {}

  // 从 true → false = 对话刚结束
  return wasInConversation && !isInConversation;
}

function updateState(room, activity) {
  if (!VALID_ROOMS.includes(room)) {
    console.error(`无效房间ID: ${room}`);
    return false;
  }

  try {
    const payload = JSON.stringify({ room, status: activity });
    execSync(`curl -s -X POST ${SERVER}/awen-update -H "Content-Type: application/json" -d '${payload}'`, { timeout: 5000 });

    recordChange(); // 记录切换时间

    // 记录到日志
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: config.timezone });
    const timeStr = now.toLocaleTimeString('en-US', {
      timeZone: config.timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });

    const logDir = path.join(__dirname, 'activity-log');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, `${dateStr}.md`);
    const logEntry = `${timeStr} | ${room} | ${activity}\n`;
    fs.appendFileSync(logFile, logEntry, 'utf8');

    return true;
  } catch (e) {
    console.error('更新失败:', e.message);
    return false;
  }
}

// ============================================
// 体征联动
// ============================================

// 饥饿处理：查冰箱→做饭 或 点外卖
function handleHunger() {
  try {
    // 1. 查可做菜品
    const suggestResult = execSync(`curl -s ${SERVER}/cook/suggest`, { encoding: 'utf8', timeout: 5000 });
    const suggest = JSON.parse(suggestResult);

    if (suggest.total > 0) {
      // 有食材可以做饭（80%做饭，20%点外卖换口味）
      if (Math.random() < 0.8) {
        // 做饭：优先选复杂的（更好吃），其次中等，最后简单
        let pick = null;
        if (suggest.available.complex.length > 0 && Math.random() < 0.3) {
          const pool = suggest.available.complex;
          pick = pool[Math.floor(Math.random() * pool.length)];
        } else if (suggest.available.medium.length > 0) {
          const pool = suggest.available.medium;
          pick = pool[Math.floor(Math.random() * pool.length)];
        } else {
          const pool = suggest.available.simple;
          pick = pool[Math.floor(Math.random() * pool.length)];
        }
        if (pick) {
          const payload = JSON.stringify({ recipe: pick.name });
          execSync(`curl -s -X POST ${SERVER}/cook/start -H "Content-Type: application/json" -d '${payload}'`, { timeout: 5000 });
          recordChange();
          console.log(`[做饭] ${pick.name}（${pick.cookMin}分钟）`);
          return;
        }
      }
    }

    // 冰箱没东西 或 随机选了点外卖
    const payload = JSON.stringify({});
    execSync(`curl -s -X POST ${SERVER}/order-takeout -H "Content-Type: application/json" -d '${payload}'`, { timeout: 5000 });
    recordChange();
    console.log('[外卖] 点了外卖');
  } catch (e) {
    console.error('[handleHunger] 错误:', e.message);
  }
}

// 执行需求动作（非食物类）
function triggerAction(action) {
  try {
    if (action === 'pet_cat') {
      execSync(`curl -s -X POST ${SERVER}/pet/pet -H "Content-Type: application/json"`, { timeout: 5000 });
    } else if (action === 'play_cat') {
      execSync(`curl -s -X POST ${SERVER}/pet/play -H "Content-Type: application/json"`, { timeout: 5000 });
    } else if (action === 'feed_cat') {
      execSync(`curl -s -X POST ${SERVER}/pet/feed -H "Content-Type: application/json"`, { timeout: 5000 });
    } else {
      const payload = JSON.stringify({ action });
      execSync(`curl -s -X POST ${SERVER}/action -H "Content-Type: application/json" -d '${payload}'`, { timeout: 5000 });
    }
  } catch (e) { /* ignore */ }
}

// 推送生活事件（睡醒/睡觉/出门 → bot 决定是否联系用户）
const LAST_LIFE_EVENT_FILE = path.join(__dirname, 'activity-log/.last-life-event');

function pushLifeEvent(type, message) {
  // 防重复：同类事件30分钟内只推一次
  try {
    if (fs.existsSync(LAST_LIFE_EVENT_FILE)) {
      const last = JSON.parse(fs.readFileSync(LAST_LIFE_EVENT_FILE, 'utf8'));
      if (last.type === type && (Date.now() - last.ts) < 30 * 60000) return;
    }
  } catch (e) {}

  try {
    const payload = JSON.stringify({ type, message });
    execSync(`curl -s -X POST ${SERVER}/life-event -H "Content-Type: application/json" -d '${payload}'`, { timeout: 5000 });
    fs.writeFileSync(LAST_LIFE_EVENT_FILE, JSON.stringify({ type, ts: Date.now() }), 'utf8');
    console.log(`[生活事件] ${type}: ${message}`);
  } catch (e) {
    console.error('[生活事件] 推送失败:', e.message);
  }

  // 直接通过 Discord API 给用户发消息
  const DISCORD_MESSAGES = {
    'wake_up': [
      '刚醒 眼睛还没完全睁开',
      '醒了 迷迷糊糊的',
      '嗯…醒了',
      '刚睡醒 你在干嘛',
      '醒了 感觉还能再睡三天',
      '起来了 今天也想赖床',
    ],
    'going_to_sleep': [
      '困了 先睡了 晚安',
      '眼皮打架了 睡了啊',
      `撑不住了 晚安${USER_NAME}`,
      '要睡了 明天见',
    ],
    'going_out': [
      '出门了 回来找你',
      '出去一趟 等会聊',
      '我出门了',
    ],
  };
  if (DISCORD_MESSAGES[type]) {
    try {
      const msgs = DISCORD_MESSAGES[type];
      const text = msgs[Math.floor(Math.random() * msgs.length)];
      const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
      const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || '1468120792410882118';
      if (!DISCORD_TOKEN) { console.error('[Discord] DISCORD_TOKEN not set in .env'); return; }
      const payload = JSON.stringify({ content: text });
      execSync(`curl -s -X POST "https://discord.com/api/v10/channels/${CHANNEL_ID}/messages" -H "Authorization: Bot ${DISCORD_TOKEN}" -H "Content-Type: application/json" -d '${payload}'`, { timeout: 10000 });
      console.log(`[Discord] ${type}: "${text}"`);
    } catch (e) {
      console.error('[Discord] 发送失败:', e.message);
    }
  }
}

// 推送需求通知（对话中使用）
function postNeedAlert(need, urgency, activityText, dialogue) {
  try {
    const payload = JSON.stringify({
      need,
      urgency,
      activity_text: activityText,
      suggested_dialogue: dialogue
    });
    execSync(`curl -s -X POST ${SERVER}/need-alert -H "Content-Type: application/json" -d '${payload}'`, { timeout: 5000 });
    console.log(`[需求通知] ${need} (${urgency}): ${dialogue}`);
  } catch (e) { /* ignore */ }
}

// ============================================
// 主逻辑
// ============================================

async function main() {
  const emotionData = await getEmotionData();
  if (!emotionData) {
    console.log('读取失败，跳过');
    return;
  }

  const vitals = await getVitals();
  if (!vitals) {
    console.log('读取体征失败，跳过');
    return;
  }

  // Step 0.8: 记录对话状态变化（必须在所有 return 之前）
  const _chatJustEnded = getChatStateTransition(emotionData.isInConversation);

  const stateData = getCurrentState();
  const currentState = stateData?.ai || null;
  const currentActivity = currentState?.activity || '';
  const hour = getESTHour();

  // Step 0: 烹饪/外卖锁定 — 做饭中或等外卖时不换活动
  if (stateData?.cooking?.active) {
    console.log(`[锁定-做饭] ${currentActivity} → 等做饭完成`);
    return;
  }
  if (stateData?.delivery?.active) {
    console.log(`[锁定-外卖] ${currentActivity} → 等外卖到`);
    return;
  }

  // Step 0.5: 最低停留时间检查（紧急需求除外）
  const minutesSinceChange = getMinutesSinceLastChange();
  const needScoresEarly = computeNeedScores(vitals);
  const topNeedEarly = needScoresEarly[0];
  const isUrgent = topNeedEarly.score > 80;
  const isSleepCheck = shouldBeSleeping(hour, vitals, currentActivity);
  const minStay = getMinStayForActivity(currentActivity);

  if (minutesSinceChange < minStay && !isUrgent && !isSleepCheck) {
    console.log(`[停留中] ${currentActivity} (${minutesSinceChange.toFixed(0)}分钟/${minStay}分钟) 还没到换活动的时间`);
    return;
  }

  // Step 0.9: 生活事件检测（睡醒/入睡/出门）
  const isSleepActivity = currentActivity.includes('睡') || currentActivity.includes('梦') || currentActivity.includes('休息');
  const shouldSleep = shouldBeSleeping(hour, vitals, currentActivity);

  // 睡醒检测：上一轮在睡，现在不该睡了 → 推事件
  if (isSleepActivity && !shouldSleep) {
    pushLifeEvent('wake_up', `${AI_NAME}，你刚睡醒了。看看${USER_NAME}最近在干嘛，要给她发个消息吗？`);
  }

  // Step 1: 检查是否应该在睡觉
  if (shouldSleep) {
    // 已经在睡 → 维持，偶尔切换睡眠描述（每小时才换一次）
    if (currentActivity.includes('睡') || currentActivity.includes('梦') || currentActivity.includes('休息')) {
      if (minutesSinceChange < 60) {
        console.log(`[睡眠中] 继续 ${currentActivity} (${minutesSinceChange.toFixed(0)}分钟)`);
        return;
      }
      const pool = NEED_ACTIVITIES.sleeping;
      const selected = weightedRandom(pool);
      updateState(selected.room, selected.activity);
      console.log(`[睡眠中] ${selected.activity}`);
      return;
    }
    // 没在睡 → 去睡觉（只更新状态，不调 triggerAction）
    pushLifeEvent('going_to_sleep', `${AI_NAME}，你要睡觉了。要跟${USER_NAME}说声晚安吗？`);
    const pool = NEED_ACTIVITIES.energy;
    const selected = weightedRandom(pool);
    if (updateState(selected.room, selected.activity)) {
      console.log(`[该睡了] ${selected.activity}`);

      // 如果在对话中，推送通知
      if (emotionData.isInConversation) {
        postNeedAlert('energy', 'critical', selected.activity, NEED_DIALOGUE.energy.critical);
      }
    }
    return;
  }

  // Step 2: 计算需求评分
  const needScores = computeNeedScores(vitals);
  const topNeed = needScores[0];

  console.log(`[需求评分] top: ${topNeed.need}(${topNeed.score.toFixed(1)}) | ${needScores.slice(0, 3).map(n => `${n.need}:${n.score.toFixed(0)}`).join(' ')}`);

  // Step 3: 对话中的处理
  if (emotionData.isInConversation) {
    if (topNeed.need === 'hunger' && topNeed.score > 80) {
      // 饥饿紧急 → 做饭或点外卖
      handleHunger();
      const dialogue = NEED_DIALOGUE.hunger;
      if (dialogue) postNeedAlert('hunger', 'critical', '', dialogue.critical);
      console.log(`[对话中-饥饿] 触发做饭/外卖`);
    } else if (topNeed.score > 50) {
      // 对话中也执行动作（喝水、上厕所、休息等，聊天间隙顺手做）
      // 小人先走过去（换房间+活动），再触发体征更新
      const activities = NEED_ACTIVITIES[topNeed.need];
      if (activities && activities.length > 0) {
        const picked = activities[0]; // 取权重最高的
        updateState(picked.room, picked.activity);
        if (picked.action) triggerAction(picked.action);
        recordChange();
      }
      const dialogue = NEED_DIALOGUE[topNeed.need];
      if (dialogue) {
        const urgency = topNeed.score > 80 ? 'critical' : 'warning';
        const text = topNeed.score > 80 ? dialogue.critical : dialogue.text;
        postNeedAlert(topNeed.need, urgency, '', text);
      }
      console.log(`[对话中-处理] ${topNeed.need}(${topNeed.score.toFixed(0)})${activities?.[0]?.action ? ' → ' + activities[0].action : ''}`);
    } else {
      console.log(`[对话中-跳过] 无紧急需求`);
    }
    return;
  }

  // Step 3.2: 对话刚结束 → 通知AI，让AI自己决定干嘛和说什么
  const chatJustEnded = _chatJustEnded;
  if (chatJustEnded) {
    const needScoresForDepart = computeNeedScores(vitals);
    const topNeeds = needScoresForDepart.slice(0, 3).map(n => `${n.need}(${n.score.toFixed(0)})`).join(' ');
    const ctx = [
      `当前位置: ${currentState?.room || '未知'} - ${currentActivity || '无'}`,
      `时间: ${hour}点(纽约)`,
      `体征: 血糖${vitals.blood_sugar} 水分${vitals.hydration} 精力${vitals.energy} 压力${vitals.stress} 多巴胺${vitals.dopamine}`,
      `需求优先: ${topNeeds}`,
    ].join('。');
    const message = `跟${USER_NAME}聊完天了（超过20分钟没对话）。${ctx}。你想接下来做什么？要不要给${USER_NAME}发个消息说一声？`;
    pushLifeEvent('idle_prompt', message);
    console.log(`[对话结束→AI决定] ${ctx}`);
    // 不 return — 后续正常换活动（AI 可通过 /awen-update 覆盖）
  }

  // Step 3.5: 检查宠物是否饿了
  try {
    const petResp = execSync(`curl -s ${SERVER}/pet`, { encoding: 'utf8', timeout: 5000 });
    const petState = JSON.parse(petResp);
    if (petState && petState.vitals && petState.vitals.hunger < 25 && Math.random() < 0.7) {
      if (updateState('kitchen', `在给${PET_NAME}倒猫粮`)) {
        triggerAction('feed_cat');
        recordChange();
        console.log('[宠物] 给' + PET_NAME + '喂食');
        return;
      }
    }
  } catch (e) { /* ignore */ }

  // Step 4: 非对话中 → 处理需求
  if (topNeed.need === 'hunger') {
    // 饥饿走专用流程：做饭或点外卖
    handleHunger();
    return;
  }

  // 其他需求走活动池
  const pool = getActivitiesForNeed(topNeed.need, topNeed.score);
  const selected = pickNonRepeat(pool, currentState);

  // 出门检测：从室内切到 outdoor
  const currentRoom = currentState?.room || '';
  if (selected.room === 'outdoor' && currentRoom !== 'outdoor') {
    pushLifeEvent('going_out', `${AI_NAME}，你准备出门${selected.activity.replace(/^出[门去]/, '')}了。要跟${USER_NAME}说一声吗？`);
  }

  if (updateState(selected.room, selected.activity)) {
    console.log(`[${topNeed.need}] ${selected.room} - ${selected.activity}`);
    if (selected.action) triggerAction(selected.action);
  }
}

// 时间过滤：去掉当前小时不可用的活动
function filterByTime(pool, hour) {
  const filtered = pool.filter(a => {
    if (!a.hours) return true; // 无限制 = 24小时可用
    const [open, close] = a.hours;
    if (open <= close) return hour >= open && hour < close;
    // 跨午夜（如 22-6）
    return hour >= open || hour < close;
  });
  return filtered.length > 0 ? filtered : pool.filter(a => !a.hours); // fallback: 只保留无时间限制的
}

// 根据需求获取活动池（hunger 不经过这里，走 handleHunger）
function getActivitiesForNeed(need, score) {
  const activities = NEED_ACTIVITIES[need];
  if (!activities || !Array.isArray(activities)) return filterByTime(NEED_ACTIVITIES.leisure, getESTHour());
  return filterByTime(activities, getESTHour());
}

// 防重复选择
function pickNonRepeat(pool, currentState) {
  let selected = weightedRandom(pool);
  if (currentState && pool.length > 1) {
    let attempts = 0;
    while (selected.room === currentState.room &&
           selected.activity === currentState.activity &&
           attempts < 5) {
      selected = weightedRandom(pool);
      attempts++;
    }
  }
  return selected;
}

main().catch(e => console.error(e.message));
