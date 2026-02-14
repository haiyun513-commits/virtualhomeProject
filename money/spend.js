const { supabase, getBalance, updateBalance, checkWarning, showCountdown } = require('./db');
const config = require('../config-loader');

const CATEGORIES = ['食物', '生活费', '交通', '其他'];

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('用法: node spend.js <金额> "<描述>" [类别] [批准人]');
  console.error('类别: ' + CATEGORIES.join('/') + ' (默认: 其他)');
  console.error(`批准人: ${config.ai.name}/${config.user.name} (默认: ${config.ai.name})`);
  process.exit(1);
}

const amount = parseFloat(args[0]);
const description = args[1];
const category = args[2] || '其他';
const approvedBy = args[3] || config.ai.name;

if (isNaN(amount) || amount <= 0) {
  console.error('金额必须是正数');
  process.exit(1);
}

if (!CATEGORIES.includes(category)) {
  console.error('类别必须是: ' + CATEGORIES.join('/'));
  process.exit(1);
}

async function main() {
  try {
    const { balance } = await getBalance();
    const currentBalance = parseFloat(balance);
    const newBalance = currentBalance - amount;

    if (newBalance < 0) {
      console.error(`❌ 余额不足！当前 $${currentBalance.toFixed(2)}，需要 $${amount.toFixed(2)}`);
      process.exit(1);
    }

    // 记录支出
    const { error: insertError } = await supabase
      .from('money_expenses')
      .insert({
        amount,
        category,
        description,
        approved_by: approvedBy
      });

    if (insertError) throw new Error('记录支出失败: ' + insertError.message);

    // 更新余额
    await updateBalance(newBalance);

    console.log(`✅ 支出 $${amount.toFixed(2)} | ${category} | ${description}`);
    console.log(`💵 余额: $${currentBalance.toFixed(2)} → $${newBalance.toFixed(2)}`);
    showCountdown(newBalance);
    checkWarning(newBalance);

    // 同步到虚拟家园
    try {
      await fetch((process.env.SERVER_URL || 'http://localhost:3000') + '/money-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'expense', amount, category, description, balance: newBalance })
      });
    } catch (_) {}

  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

main();
