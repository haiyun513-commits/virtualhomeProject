const { searchMemory, saveMemory } = require('./memory');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const [searchQuery, newContent, type = 'fact', importance = '0.7'] = process.argv.slice(2);

if (!searchQuery || !newContent) {
  console.error('用法: node update.js "搜索关键词" "新内容" [类型] [重要度]');
  console.error('流程: 搜索相关旧记忆 → 删除它们 → 存入新内容');
  process.exit(1);
}

(async () => {
  // 1. 搜索相关旧记忆（相似度 >= 0.6 的都算相关）
  const oldMemories = await searchMemory(searchQuery, 0.6, 10);

  if (oldMemories.length === 0) {
    console.log('没找到相关旧记忆 直接存新的');
  } else {
    console.log(`找到 ${oldMemories.length} 条相关记忆:`);
    oldMemories.forEach(m => console.log(`  [${m.similarity.toFixed(3)}] ${m.content.slice(0, 60)}`));

    // 2. 删除旧记忆
    for (const m of oldMemories) {
      const { error } = await supabase.from('memories').delete().eq('id', m.id);
      if (error) {
        console.error(`❌ 删除失败 (${m.id}):`, error.message);
      } else {
        console.log(`🗑️ 已删除: ${m.content.slice(0, 40)}`);
      }
    }
  }

  // 3. 存新记忆
  const result = await saveMemory(newContent, type, parseFloat(importance));
  console.log('✅ 新记忆已保存:', newContent.slice(0, 60));
})().catch(e => { console.error(e.message); process.exit(1); });
