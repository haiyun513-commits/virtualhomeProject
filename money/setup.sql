-- 金钱管理系统 - 建表SQL
-- 在 Supabase SQL Editor 中执行

-- 1. 账户余额表（单行）
CREATE TABLE IF NOT EXISTS money_balance (
  id INTEGER PRIMARY KEY DEFAULT 1,
  balance DECIMAL NOT NULL DEFAULT 765.27,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO money_balance (id, balance) VALUES (1, 765.27)
ON CONFLICT (id) DO NOTHING;

-- 2. 支出记录表
CREATE TABLE IF NOT EXISTS money_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL NOT NULL,
  category TEXT NOT NULL DEFAULT '其他',
  description TEXT,
  approved_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS money_expenses_created_idx ON money_expenses(created_at);

-- 3. 收入记录表
CREATE TABLE IF NOT EXISTS money_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount DECIMAL NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS money_income_created_idx ON money_income(created_at);

-- 4. 每日食物记录表
CREATE TABLE IF NOT EXISTS money_food_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal TEXT NOT NULL,
  content TEXT NOT NULL,
  cost DECIMAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT '冰箱',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS money_food_log_date_idx ON money_food_log(log_date);
