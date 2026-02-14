require('dotenv').config({ path: require('path').join(__dirname, '../memory-system/.env'), quiet: true });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const validCategories = ['蔬菜', '肉类', '水果', '调料', '饮品', '冷冻', '乳制品', '主食', '其他'];

const args = process.argv.slice(2);

if (args.length < 4) {
  console.error('用法: node add.js "食材名" "类别" 数量 "单位" "过期日期(可选)"');
  console.error('类别: ' + validCategories.join('/'));
  process.exit(1);
}

const [name, category, quantityStr, unit, expiresAt] = args;
const quantity = parseFloat(quantityStr);

if (!validCategories.includes(category)) {
  console.error('类别必须是: ' + validCategories.join('/'));
  process.exit(1);
}

if (isNaN(quantity) || quantity <= 0) {
  console.error('数量必须是正数');
  process.exit(1);
}

async function addItem() {
  const item = {
    name,
    category,
    quantity,
    unit,
    status: '在库',
    purchase_date: new Date().toISOString().split('T')[0],
  };

  if (expiresAt) {
    item.expiry_date = expiresAt;
  }

  const { data, error } = await supabase
    .from('fridge_items')
    .insert(item)
    .select('id, name, category, quantity, unit');

  if (error) {
    console.error('添加失败:', error.message);
    process.exit(1);
  }

  console.log('✅ 已添加:', data[0].name, data[0].quantity + data[0].unit, '(' + data[0].category + ')');
}

addItem();
