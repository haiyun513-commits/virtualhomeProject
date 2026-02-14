#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../memory-system/.env'), quiet: true });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function cleanup() {
  const now = new Date().toISOString().split('T')[0];

  // 1. 先把已过期但还标着"在库"的标记为"过期"
  const { data: expired } = await supabase
    .from('fridge_items')
    .select('id, name, expiry_date')
    .eq('status', '在库')
    .not('expiry_date', 'is', null)
    .lt('expiry_date', now);

  if (expired && expired.length > 0) {
    for (const item of expired) {
      await supabase
        .from('fridge_items')
        .update({ status: '过期' })
        .eq('id', item.id);
    }
    console.log(`标记 ${expired.length} 项过期:`);
    expired.forEach(i => console.log(`  ${i.name} (过期于${i.expiry_date})`));
  }

  // 2. 删除所有状态为"过期"且过期超过7天的
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: toDelete } = await supabase
    .from('fridge_items')
    .select('id, name, expiry_date')
    .eq('status', '过期')
    .lt('expiry_date', sevenDaysAgo);

  if (toDelete && toDelete.length > 0) {
    const ids = toDelete.map(i => i.id);
    await supabase
      .from('fridge_items')
      .delete()
      .in('id', ids);
    console.log(`清理 ${toDelete.length} 项（过期超7天）:`);
    toDelete.forEach(i => console.log(`  🗑️ ${i.name}`));
  }

  if ((!expired || expired.length === 0) && (!toDelete || toDelete.length === 0)) {
    console.log('✅ 冰箱很干净 没有需要清理的');
  }
}

cleanup().catch(e => { console.error(e.message); process.exit(1); });
