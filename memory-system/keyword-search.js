require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const [keyword, limit = '20'] = process.argv.slice(2);

if (!keyword) {
  console.error('用法: node keyword-search.js "关键词" [数量]');
  process.exit(1);
}

async function keywordSearch(kw, lim) {
  const { data, error } = await supabase
    .from('memories')
    .select('id, content, memory_type, importance, created_at')
    .ilike('content', `%${kw}%`)
    .order('created_at', { ascending: false })
    .limit(lim);

  if (error) throw error;
  return data;
}

keywordSearch(keyword, parseInt(limit))
  .then(results => {
    if (!results || !results.length) {
      console.log('无匹配记忆');
      return;
    }
    console.log(`找到 ${results.length} 条记忆：\n`);
    results.forEach(r => {
      const time = new Date(r.created_at).toLocaleString('zh-CN');
      console.log(`[${r.memory_type}] ${r.content}`);
      console.log(`    时间: ${time} | 重要度: ${r.importance} | ID: ${r.id}\n`);
    });
  })
  .catch(e => {
    console.error('搜索失败:', e.message);
    process.exit(1);
  });
