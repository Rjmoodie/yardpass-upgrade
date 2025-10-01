-- YardPass Wallet & Credits - Initial Migration
-- Generated: 2025-09-30

-- Enable extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0) Utility: updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1) wallets
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_credits INT NOT NULL DEFAULT 0,
  low_balance_threshold INT NOT NULL DEFAULT 0,
  auto_reload_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  auto_reload_topup_credits INT,
  default_payment_method_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wallets_status_chk CHECK (status IN ('active','frozen')),
  CONSTRAINT wallets_user_id_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON wallets;
CREATE TRIGGER trg_wallets_updated_at
BEFORE UPDATE ON wallets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2) credit_packages
CREATE TABLE IF NOT EXISTS credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credits INT NOT NULL CHECK (credits > 0),
  price_usd_cents INT NOT NULL CHECK (price_usd_cents >= 0),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_credit_packages_updated_at ON credit_packages;
CREATE TRIGGER trg_credit_packages_updated_at
BEFORE UPDATE ON credit_packages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3) wallet_transactions (ledger)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  credits_delta INT NOT NULL,
  usd_cents INT,
  reference_type TEXT,
  reference_id TEXT,
  memo TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wallet_txn_type_chk CHECK (type IN ('purchase','spend','refund','adjustment','promo'))
);

CREATE INDEX IF NOT EXISTS idx_wallet_txns_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txns_ref ON wallet_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txns_created_at ON wallet_transactions(created_at);

-- 4) invoices (top-ups)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  amount_usd_cents INT NOT NULL CHECK (amount_usd_cents >= 0),
  credits_purchased INT NOT NULL CHECK (credits_purchased >= 0),
  promo_code TEXT,
  tax_usd_cents INT NOT NULL DEFAULT 0 CHECK (tax_usd_cents >= 0),
  status TEXT NOT NULL,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoices_status_chk CHECK (status IN ('pending','paid','failed','refunded'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_wallet_id ON invoices(wallet_id);

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 5) ad_spend_ledger (link spend to deductions)
CREATE TABLE IF NOT EXISTS ad_spend_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity >= 0),
  rate_model TEXT NOT NULL,
  rate_usd_cents INT NOT NULL CHECK (rate_usd_cents >= 0),
  credits_charged INT NOT NULL CHECK (credits_charged >= 0),
  occurred_at TIMESTAMPTZ NOT NULL,
  wallet_transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ad_spend_metric_chk CHECK (metric_type IN ('impression','click','other')),
  CONSTRAINT ad_spend_rate_model_chk CHECK (rate_model IN ('cpm','cpc'))
);

CREATE INDEX IF NOT EXISTS idx_ad_spend_wallet_time ON ad_spend_ledger(wallet_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ad_spend_campaign_time ON ad_spend_ledger(campaign_id, occurred_at);

-- 6) promos
CREATE TABLE IF NOT EXISTS promos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL,
  value INT NOT NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  max_uses INT,
  per_user_limit INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT promos_discount_type_chk CHECK (discount_type IN ('percent','amount','extra_credits'))
);

DROP TRIGGER IF EXISTS trg_promos_updated_at ON promos;
CREATE TRIGGER trg_promos_updated_at
BEFORE UPDATE ON promos
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 7) helper function: recompute wallet balance from ledger (admin/debug)
CREATE OR REPLACE FUNCTION recompute_wallet_balance(p_wallet UUID)
RETURNS INT AS $$
DECLARE
  new_balance INT;
BEGIN
  SELECT COALESCE(SUM(credits_delta),0) INTO new_balance
  FROM wallet_transactions WHERE wallet_id = p_wallet;
  UPDATE wallets SET balance_credits = new_balance, updated_at = NOW()
  WHERE id = p_wallet;
  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8) Function to ensure wallet exists for user (called from trigger or app)
CREATE OR REPLACE FUNCTION ensure_wallet_exists(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  INSERT INTO wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_wallet_id;
  
  IF v_wallet_id IS NULL THEN
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
  END IF;
  
  RETURN v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 9) Seed credit packages
INSERT INTO credit_packages (name, credits, price_usd_cents, is_default, is_active, sort_order)
VALUES
  ('Starter', 5000, 5000, FALSE, TRUE, 10),
  ('Standard', 10000, 10000, TRUE, TRUE, 20),
  ('Pro', 25000, 25000, FALSE, TRUE, 30)
ON CONFLICT DO NOTHING;

-- 10) RLS Policies
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_spend_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE promos ENABLE ROW LEVEL SECURITY;

-- Users can view their own wallet
CREATE POLICY wallets_select_own ON wallets
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own wallet settings (not balance directly)
CREATE POLICY wallets_update_own ON wallets
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND balance_credits = (SELECT balance_credits FROM wallets WHERE id = wallets.id));

-- Everyone can view active credit packages
CREATE POLICY credit_packages_select_all ON credit_packages
  FOR SELECT USING (is_active = TRUE);

-- Users can view their own wallet transactions
CREATE POLICY wallet_transactions_select_own ON wallet_transactions
  FOR SELECT USING (wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid()));

-- System can insert transactions (via service role)
CREATE POLICY wallet_transactions_insert_system ON wallet_transactions
  FOR INSERT WITH CHECK (true);

-- Users can view their own invoices
CREATE POLICY invoices_select_own ON invoices
  FOR SELECT USING (wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid()));

-- System can manage invoices
CREATE POLICY invoices_insert_system ON invoices
  FOR INSERT WITH CHECK (true);

CREATE POLICY invoices_update_system ON invoices
  FOR UPDATE USING (true);

-- Users can view their own ad spend
CREATE POLICY ad_spend_select_own ON ad_spend_ledger
  FOR SELECT USING (wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid()));

-- System can insert ad spend records
CREATE POLICY ad_spend_insert_system ON ad_spend_ledger
  FOR INSERT WITH CHECK (true);

-- Everyone can view active promos
CREATE POLICY promos_select_all ON promos
  FOR SELECT USING (
    (starts_at IS NULL OR starts_at <= now()) AND
    (ends_at IS NULL OR ends_at >= now())
  );