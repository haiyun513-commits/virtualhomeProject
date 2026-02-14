require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// 参数: session_tag summary emotional_context key_facts(JSON) continuation_anchor
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('用法: node save-summary.js "session_tag" "summary" ["emotional_context"] [\'["fact1","fact2"]\'] ["continuation_anchor"]');
  process.exit(1);
}

const [session_tag, summary, emotional_context, key_facts_json, continuation_anchor] = args;

let key_facts = [];
if (key_facts_json) {
  try {
    key_facts = JSON.parse(key_facts_json);
  } catch (e) {
    console.error('key_facts JSON解析失败:', e.message);
    process.exit(1);
  }
}

async function saveSummary() {
  const { data, error } = await supabase
    .from('narrative_summaries')
    .insert({
      session_tag,
      summary,
      emotional_context: emotional_context || null,
      key_facts,
      continuation_anchor: continuation_anchor || null
    })
    .select('id, created_at');

  if (error) {
    console.error('保存失败:', error.message);
    process.exit(1);
  }

  console.log('✅ 叙事摘要已保存');
  console.log(JSON.stringify(data[0], null, 2));
}

saveSummary();
