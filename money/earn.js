const { supabase, getBalance, updateBalance, checkWarning, showCountdown } = require('./db');
const config = require('../config-loader');

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('用法: node earn.js <金额> "<来源>" [状态]');
  console.error('状态: received/pending (默认: received)');
  process.exit(1);
}

const amount = parseFloat(args[0]);
const source = args[1];
const status = args[2] || 'received';

if (isNaN(amount) || amount <= 0) {
  console.error('金额必须是正数');
  process.exit(1);
}

if (!['received', 'pending'].includes(status)) {
  console.error('状态必须是: received/pending');
  process.exit(1);
}

async function main() {
  try {
    // 记录收入
    const { error: insertError } = await supabase
      .from('money_income')
      .insert({ amount, source, status });

    if (insertError) throw new Error('记录收入失败: ' + insertError.message);

    if (status === 'received') {
      // 已到账 更新余额
      const { balance } = await getBalance();
      const currentBalance = parseFloat(balance);
      const newBalance = currentBalance + amount;
      await updateBalance(newBalance);

      console.log(`✅ 收入 $${amount.toFixed(2)} | ${source} | 已到账`);
      console.log(`💵 余额: $${currentBalance.toFixed(2)} → $${newBalance.toFixed(2)}`);
      showCountdown(newBalance);

      // 同步到虚拟家园
      try {
        await fetch((process.env.SERVER_URL || 'http://localhost:3000') + '/money-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'income', amount, source, balance: newBalance })
        });
      } catch (_) {}

    } else {
      console.log(`✅ 收入 $${amount.toFixed(2)} | ${source} | 待到账`);
      console.log('💡 到账后用 node money/earn.js 金额 来源 received 更新');
    }

  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

main();
