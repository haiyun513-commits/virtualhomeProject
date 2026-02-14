const { supabase, getBalance, updateBalance, checkWarning, showCountdown } = require('./db');
const config = require('../config-loader');

const MEALS = ['早餐', '午餐', '晚餐', '零食', '饮品'];

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('用法: node food.js "<餐次>" "<内容>" [花费] [来源]');
  console.error('餐次: ' + MEALS.join('/'));
  console.error('来源: 冰箱/购买 (默认: 冰箱)');
  process.exit(1);
}

const meal = args[0];
const content = args[1];
const cost = parseFloat(args[2]) || 0;
const source = args[3] || '冰箱';

if (!MEALS.includes(meal)) {
  console.error('餐次必须是: ' + MEALS.join('/'));
  process.exit(1);
}

async function main() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 记录食物
    const { error: insertError } = await supabase
      .from('money_food_log')
      .insert({ log_date: today, meal, content, cost, source });

    if (insertError) throw new Error('记录失败: ' + insertError.message);

    // 如果有花费 同时记录支出并扣余额
    if (cost > 0) {
      const { balance } = await getBalance();
      const currentBalance = parseFloat(balance);
      const newBalance = currentBalance - cost;

      await supabase
        .from('money_expenses')
        .insert({
          amount: cost,
          category: '食物',
          description: `${meal}: ${content}`,
          approved_by: config.ai.name
        });

      await updateBalance(newBalance);

      console.log(`🍽️  ${meal}: ${content}`);
      console.log(`💸 花费 $${cost.toFixed(2)} (${source})`);
      console.log(`💵 余额: $${newBalance.toFixed(2)}`);
      checkWarning(newBalance);
    } else {
      console.log(`🍽️  ${meal}: ${content} (${source} 免费)`);
    }

    // 显示今天吃了什么
    const { data: todayFood } = await supabase
      .from('money_food_log')
      .select('meal, content, cost, source')
      .eq('log_date', today)
      .order('created_at');

    if (todayFood && todayFood.length > 1) {
      const todayCost = todayFood.reduce((sum, f) => sum + parseFloat(f.cost), 0);
      console.log(`\n📋 今日饮食 (共 $${todayCost.toFixed(2)}):`);
      todayFood.forEach(f => {
        const costStr = parseFloat(f.cost) > 0 ? ` $${parseFloat(f.cost).toFixed(2)}` : ' 免费';
        console.log(`  ${f.meal}: ${f.content} |${costStr} | ${f.source}`);
      });
    }

  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
}

main();
