require('dotenv').config({ path: require('path').join(__dirname, '../memory-system/.env'), quiet: true });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const TARGET_DATE = new Date('2026-03-11');
const WARN_THRESHOLD = 200;

async function getBalance() {
  const { data, error } = await supabase
    .from('money_balance')
    .select('balance, updated_at')
    .eq('id', 1)
    .single();
  if (error) throw new Error('读取余额失败: ' + error.message);
  return data;
}

async function updateBalance(newBalance) {
  const { error } = await supabase
    .from('money_balance')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) throw new Error('更新余额失败: ' + error.message);
}

function daysLeft() {
  const now = new Date();
  const diff = TARGET_DATE - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function checkWarning(balance) {
  if (balance < WARN_THRESHOLD) {
    console.log(`\n⚠️  警告：余额不足$${WARN_THRESHOLD}！当前$${balance.toFixed(2)}`);
  }
}

function showCountdown(balance) {
  const days = daysLeft();
  const perDay = days > 0 ? (balance / days).toFixed(2) : '—';
  console.log(`📅 距离3月11日还有 ${days} 天 | 每天可用 $${perDay}`);
}

module.exports = { supabase, getBalance, updateBalance, daysLeft, checkWarning, showCountdown, TARGET_DATE, WARN_THRESHOLD };
