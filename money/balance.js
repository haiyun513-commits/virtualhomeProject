const { supabase, getBalance, checkWarning, showCountdown } = require('./db');

async function main() {
  try {
    const { balance } = await getBalance();

    // 获取今天的支出
    const today = new Date().toISOString().split('T')[0];
    const { data: todayExpenses } = await supabase
      .from('money_expenses')
      .select('amount, category, description')
      .gte('created_at', today + 'T00:00:00')
      .lte('created_at', today + 'T23:59:59')
      .order('created_at', { ascending: false });

    // 获取本周总支出
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: weekExpenses } = await supabase
      .from('money_expenses')
      .select('amount')
      .gte('created_at', weekAgo);

    const weekTotal = (weekExpenses || []).reduce((sum, e) => sum + parseFloat(e.amount), 0);
    const todayTotal = (todayExpenses || []).reduce((sum, e) => sum + parseFloat(e.amount), 0);

    // 获取总收入
    const { data: allIncome } = await supabase
      .from('money_income')
      .select('amount')
      .eq('status', 'received');

    const totalIncome = (allIncome || []).reduce((sum, e) => sum + parseFloat(e.amount), 0);

    console.log('\n💰 金钱管理系统');
    console.log('═══════════════════════════');
    console.log(`💵 当前余额: $${parseFloat(balance).toFixed(2)}`);
    console.log(`📊 今日支出: $${todayTotal.toFixed(2)}`);
    console.log(`📊 本周支出: $${weekTotal.toFixed(2)}`);
    console.log(`📈 累计收入: $${totalIncome.toFixed(2)}`);
    console.log('───────────────────────────');
    showCountdown(parseFloat(balance));
    checkWarning(parseFloat(balance));

    if (todayExpenses && todayExpenses.length > 0) {
      console.log('\n📋 今日明细:');
      todayExpenses.forEach(e => {
        console.log(`  ${e.category} | $${parseFloat(e.amount).toFixed(2)} | ${e.description || ''}`);
      });
    }

    console.log('');
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

main();
