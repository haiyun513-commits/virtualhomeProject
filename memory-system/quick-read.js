#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function quickRead() {
  try {
    const { data, error } = await supabase
      .from('session_quicksaves')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      console.log('📭 没有 quick save 记录');
      return;
    }

    const save = data[0];
    const time = new Date(save.created_at);
    const now = new Date();
    const diffMs = now - time;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    console.log('═══ 上次对话 ═══');
    console.log(`⏰ ${time.toLocaleString('zh-CN', { timeZone: 'America/New_York' })} (${diffHours > 0 ? diffHours + '小时' : ''}${diffMins}分钟前)`);
    console.log(`📝 ${save.content}`);
    if (save.emotion_snapshot) console.log(`💭 ${save.emotion_snapshot}`);
    if (save.next_topic) console.log(`➡️ ${save.next_topic}`);
  } catch (error) {
    console.error('❌ 读取失败:', error.message);
    process.exit(1);
  }
}

quickRead();
