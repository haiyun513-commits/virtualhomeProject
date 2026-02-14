require('dotenv').config({ path: require('path').join(__dirname, '../memory-system/.env'), quiet: true });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkExpiring() {
  const { data: items, error } = await supabase
    .from('fridge_items')
    .select('*')
    .eq('status', '在库')
    .not('expiry_date', 'is', null)
    .order('expiry_date', { ascending: true });

  if (error) {
    console.error('查询失败:', error.message);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.log('没有设置过期日期的食材');
    return;
  }

  const now = new Date();
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const expired = [];
  const expiring = [];

  for (const item of items) {
    const expiresDate = new Date(item.expiry_date);
    
    if (expiresDate < now) {
      expired.push(item);
      // 标记为过期
      await supabase
        .from('fridge_items')
        .update({ status: '过期' })
        .eq('id', item.id);
    } else if (expiresDate <= threeDaysLater) {
      expiring.push(item);
    }
  }

  if (expired.length === 0 && expiring.length === 0) {
    console.log('✅ 暂无即将过期的食材');
    return;
  }

  if (expired.length > 0) {
    console.log('\n❌ 已过期（已自动标记）:\n');
    expired.forEach(item => {
      const date = new Date(item.expiry_date).toLocaleDateString('zh-CN');
      console.log(`  ${item.name} | ${item.quantity}${item.unit} | 过期于${date}`);
    });
  }

  if (expiring.length > 0) {
    console.log('\n⚠️  即将过期（3天内）:\n');
    expiring.forEach(item => {
      const date = new Date(item.expiry_date).toLocaleDateString('zh-CN');
      const daysLeft = Math.ceil((new Date(item.expiry_date) - now) / (24 * 60 * 60 * 1000));
      console.log(`  ${item.name} | ${item.quantity}${item.unit} | 剩余${daysLeft}天 (${date})`);
    });
  }

  console.log('');
}

checkExpiring();
