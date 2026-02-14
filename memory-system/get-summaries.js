require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const limit = parseInt(process.argv[2]) || 5;

async function getSummaries() {
  const { data, error } = await supabase
    .from('narrative_summaries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('读取失败:', error.message);
    process.exit(1);
  }

  if (!data.length) {
    console.log('暂无叙事摘要');
    return;
  }

  data.forEach((s, i) => {
    const date = new Date(s.created_at).toLocaleString('zh-CN');
    console.log(`\n═══ ${i + 1}. ${s.session_tag} (${date}) ═══`);
    console.log(`📝 ${s.summary}`);
    if (s.emotional_context) {
      console.log(`💭 情绪: ${s.emotional_context}`);
    }
    if (s.key_facts && s.key_facts.length) {
      console.log(`📌 要点: ${s.key_facts.join(' | ')}`);
    }
    if (s.continuation_anchor) {
      console.log(`➡️ 下一步: ${s.continuation_anchor}`);
    }
  });
}

getSummaries();
