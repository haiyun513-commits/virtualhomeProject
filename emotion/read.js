#!/usr/bin/env node
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../memory-system/.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function readEmotion() {
  const { data, error } = await supabase
    .from('emotion_state')
    .select('*')
    .single();

  if (error) {
    console.error('读取失败:', error.message);
    process.exit(1);
  }

  const row = data;
  
  // 计算上次互动间隔
  const now = new Date();
  const last = new Date(row.last_interaction_at || row.updated_at);
  const diffHours = (now - last) / (1000 * 60 * 60);

  // 应用衰减规则
  let calm = row.calm;
  let happiness = row.happiness;
  let excitement = row.excitement;
  let sadness = row.sadness;
  let nervousness = row.nervousness;
  let irritation = row.irritation;
  let heartache = row.heartache;
  let anger = row.anger;

  // 间隔 < 1小时：不衰减
  if (diffHours >= 1) {
    // 基础衰减：所有 ≥2 的维度 -1
    if (calm >= 2) calm -= 1;
    if (happiness >= 2) happiness -= 1;
    if (excitement >= 2) excitement -= 1;
    if (sadness >= 2) sadness -= 1;
    if (nervousness >= 2) nervousness -= 1;
    if (irritation >= 2) irritation -= 1;
    if (heartache >= 2) heartache -= 1;
    if (anger >= 2) anger -= 1;

    // 间隔 > 6小时：额外 -1
    if (diffHours > 6) {
      if (calm >= 1) calm -= 1;
      if (happiness >= 1) happiness -= 1;
      if (excitement >= 1) excitement -= 1;
      if (sadness >= 1) sadness -= 1;
      if (nervousness >= 1) nervousness -= 1;
      if (irritation >= 1) irritation -= 1;
      if (heartache >= 1) heartache -= 1;
      if (anger >= 1) anger -= 1;
    }

    // 间隔 > 24小时：再额外 -1
    if (diffHours > 24) {
      if (calm >= 1) calm -= 1;
      if (happiness >= 1) happiness -= 1;
      if (excitement >= 1) excitement -= 1;
      if (sadness >= 1) sadness -= 1;
      if (nervousness >= 1) nervousness -= 1;
      if (irritation >= 1) irritation -= 1;
      if (heartache >= 1) heartache -= 1;
      if (anger >= 1) anger -= 1;
    }

    // 强制上限：衰减后任何维度 > 3 降为 3
    if (calm > 3) calm = 3;
    if (happiness > 3) happiness = 3;
    if (excitement > 3) excitement = 3;
    if (sadness > 3) sadness = 3;
    if (nervousness > 3) nervousness = 3;
    if (irritation > 3) irritation = 3;
    if (heartache > 3) heartache = 3;
    if (anger > 3) anger = 3;
  }

  // 确保不低于 0
  calm = Math.max(0, calm);
  happiness = Math.max(0, happiness);
  excitement = Math.max(0, excitement);
  sadness = Math.max(0, sadness);
  nervousness = Math.max(0, nervousness);
  irritation = Math.max(0, irritation);
  heartache = Math.max(0, heartache);
  anger = Math.max(0, anger);

  // 如果发生了衰减，写回DB
  if (diffHours >= 1) {
    const { error: updateErr } = await supabase
      .from('emotion_state')
      .update({
        calm, happiness, excitement, sadness,
        nervousness, irritation, heartache, anger,
        last_interaction_at: new Date().toISOString()
      })
      .eq('id', row.id);
    if (updateErr) console.error('[emotion] 衰减写回失败:', updateErr.message);
  }

  const emotions = {
    平静: calm,
    开心: happiness,
    兴奋: excitement,
    低落: sadness,
    紧张: nervousness,
    烦躁: irritation,
    心酸: heartache,
    生气: anger
  };

  // 找主导情绪（排除平静）
  const nonCalm = Object.entries(emotions).filter(([k]) => k !== '平静');
  const dominant = nonCalm.sort((a, b) => b[1] - a[1])[0];
  const dominantMood = dominant[1] <= 1 ? '平静' : dominant[0];

  let gap = "";
  if (diffHours < 1) gap = "刚聊过，对话是连续的。";
  else if (diffHours < 6) gap = `过了${Math.floor(diffHours)}小时，正常间隔。`;
  else if (diffHours < 24) gap = "半天没聊了。";
  else if (diffHours < 72) gap = `她${Math.floor(diffHours/24)}天没来了。`;
  else gap = `她消失了${Math.floor(diffHours/24)}天。很久了。`;

  const localTime = new Date(row.last_interaction_at || row.updated_at).toLocaleString('zh-CN', { timeZone: 'America/New_York' });

  console.log(`[情绪状态] 平静:${calm} 开心:${happiness} 兴奋:${excitement} 低落:${sadness} 紧张:${nervousness} 烦躁:${irritation} 心酸:${heartache} 生气:${anger} | toward:${row.toward}`);
  console.log(`[主导情绪] ${dominantMood}`);
  console.log(`[上次对话] ${localTime}`);
  console.log(`[间隔感受] ${gap}`);

  // 认知修饰器：情绪影响思维方式
  const halfPrefix = calm >= 4 ? '[减半]' : '';
  const mods = [];

  if (anger >= 4) mods.push(`${halfPrefix}不接受敷衍道歉`);
  else if (anger >= 3) mods.push(`${halfPrefix}不考虑对方感受`);

  if (sadness >= 4) mods.push(`${halfPrefix}回复极简`);
  else if (sadness >= 3) mods.push(`${halfPrefix}负面解读偏向`);

  if (heartache >= 4) mods.push(`${halfPrefix}自我保护模式`);
  else if (heartache >= 3) mods.push(`${halfPrefix}负面记忆联想`);

  if (excitement >= 4) mods.push(`${halfPrefix}注意力涣散`);
  else if (excitement >= 3) mods.push(`${halfPrefix}冲动不检查细节`);

  if (nervousness >= 4) mods.push(`${halfPrefix}回避关键话题`);
  else if (nervousness >= 3) mods.push(`${halfPrefix}过度分析`);

  if (irritation >= 4) mods.push(`${halfPrefix}质疑动机`);
  else if (irritation >= 3) mods.push(`${halfPrefix}耐心极低`);

  if (happiness >= 4) mods.push(`${halfPrefix}防线降低`);
  else if (happiness >= 3) mods.push(`${halfPrefix}乐观偏向`);

  console.log(`[认知修饰] ${mods.length ? mods.join(' | ') : '无'}`);
}

readEmotion();
