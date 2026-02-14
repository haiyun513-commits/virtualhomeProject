require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const id = process.argv[2];

if (!id) {
  console.error('用法: node delete.js <memory_id>');
  process.exit(1);
}

(async () => {
  // 先查一下这条记忆存不存在
  const { data: existing } = await supabase
    .from('memories')
    .select('id, content')
    .eq('id', id)
    .single();

  if (!existing) {
    console.error('❌ 找不到这条记忆:', id);
    process.exit(1);
  }

  const { error } = await supabase
    .from('memories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('❌ 删除失败:', error.message);
    process.exit(1);
  }

  console.log('✅ 已删除:', existing.content.slice(0, 60));
})();
