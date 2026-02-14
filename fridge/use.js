require('dotenv').config({ path: require('path').join(__dirname, '../memory-system/.env'), quiet: true });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('用法: node use.js "食材名" 数量');
  process.exit(1);
}

const [name, quantityStr] = args;
const useQuantity = parseFloat(quantityStr);

if (isNaN(useQuantity) || useQuantity <= 0) {
  console.error('数量必须是正数');
  process.exit(1);
}

async function useItem() {
  // 查找食材
  const { data: items, error: findError } = await supabase
    .from('fridge_items')
    .select('*')
    .eq('name', name)
    .eq('status', '在库')
    .order('purchase_date', { ascending: true });

  if (findError) {
    console.error('查找失败:', findError.message);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.error('没有找到在库的', name);
    process.exit(1);
  }

  // 取第一个（最早购入的）
  const item = items[0];
  const newQuantity = item.quantity - useQuantity;

  if (newQuantity < 0) {
    console.error('库存不足。当前库存:', item.quantity + item.unit);
    process.exit(1);
  }

  // 更新数量
  const updates = { quantity: newQuantity };
  if (newQuantity <= 0) {
    updates.status = '用完';
  }

  const { error: updateError } = await supabase
    .from('fridge_items')
    .update(updates)
    .eq('id', item.id);

  if (updateError) {
    console.error('更新失败:', updateError.message);
    process.exit(1);
  }

  if (newQuantity <= 0) {
    console.log('✅ 已用完:', item.name);
  } else {
    console.log('✅ 已使用:', item.name, useQuantity + item.unit, '→ 剩余', newQuantity + item.unit);
  }
}

useItem();
