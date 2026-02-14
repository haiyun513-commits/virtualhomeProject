#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const [content, emotionSnapshot, nextTopic] = process.argv.slice(2);

if (!content || !emotionSnapshot || !nextTopic) {
  console.error('用法: node quick-save.js "内容摘要" "情绪快照" "下次接话点"');
  console.error('三个参数都必填');
  if (!content) console.error('  缺少: 内容摘要');
  if (!emotionSnapshot) console.error('  缺少: 情绪快照');
  if (!nextTopic) console.error('  缺少: 下次接话点');
  process.exit(1);
}

async function quickSave() {
  try {
    const { data, error } = await supabase
      .from('session_quicksaves')
      .insert({
        content: content.slice(0, 200),
        emotion_snapshot: emotionSnapshot,
        next_topic: nextTopic,
      })
      .select('id, created_at');

    if (error) throw error;

    console.log('✅ Quick save 已保存');
    console.log(`时间: ${new Date(data[0].created_at).toLocaleString('zh-CN', { timeZone: 'America/New_York' })}`);
    console.log(`内容: ${content.slice(0, 50)}...`);
  } catch (error) {
    console.error('❌ 保存失败:', error.message);
    process.exit(1);
  }
}

quickSave();
