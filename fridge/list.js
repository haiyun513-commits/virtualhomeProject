require('dotenv').config({ path: require('path').join(__dirname, '../memory-system/.env'), quiet: true });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function listItems() {
  const { data: items, error } = await supabase
    .from('fridge_items')
    .select('*')
    .eq('status', '在库')
    .order('category', { ascending: true })
    .order('purchase_date', { ascending: true });

  if (error) {
    console.error('查询失败:', error.message);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.log('冰箱空空如也');
    return;
  }

  // 按类别分组
  const grouped = {};
  items.forEach(item => {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
    }
    grouped[item.category].push(item);
  });

  console.log('\n🧊 冰箱库存\n');
  
  Object.keys(grouped).forEach(category => {
    console.log(`═══ ${category} ═══`);
    grouped[category].forEach(item => {
      const purchased = new Date(item.purchase_date).toLocaleDateString('zh-CN');
      const expires = item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('zh-CN') : '-';
      console.log(`  ${item.name} | ${item.quantity}${item.unit} | 购入${purchased} | 过期${expires}`);
    });
    console.log('');
  });
}

listItems();
