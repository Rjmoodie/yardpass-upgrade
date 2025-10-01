-- Create org_wallets table (no usd_equiv)
CREATE TABLE IF NOT EXISTS public.org_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  balance_credits INTEGER NOT NULL DEFAULT 0,
  low_balance_threshold INTEGER NOT NULL DEFAULT 1000,
  auto_reload_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_reload_topup_credits INTEGER DEFAULT 5000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'frozen')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create org_wallet_transactions table
CREATE TABLE IF NOT EXISTS public.org_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.org_wallets(id) ON DELETE CASCADE,
  credits_delta INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'spend', 'refund', 'adjustment')),
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  invoice_id UUID,
  stripe_event_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_wallets_org_id ON public.org_wallets(org_id);
CREATE INDEX IF NOT EXISTS idx_org_wallet_transactions_wallet_id ON public.org_wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_org_wallet_transactions_created_at ON public.org_wallet_transactions(created_at DESC);

-- Integrity constraints
ALTER TABLE public.org_wallet_transactions
  ADD CONSTRAINT org_wallet_txn_nonzero_chk CHECK (credits_delta <> 0);

ALTER TABLE public.org_wallet_transactions
  ADD CONSTRAINT org_wallet_txn_sign_by_type_chk CHECK (
    (transaction_type = 'purchase'  AND credits_delta > 0) OR
    (transaction_type = 'spend'     AND credits_delta < 0) OR
    (transaction_type = 'refund'    AND credits_delta < 0) OR
    (transaction_type = 'adjustment')
  );

ALTER TABLE public.org_wallet_transactions
  ADD CONSTRAINT org_wallet_txn_stripe_event_unique UNIQUE (stripe_event_id);

-- Prevent duplicate purchase/refund for same invoice
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_wallet_txn_invoice_purchase
  ON public.org_wallet_transactions (invoice_id)
  WHERE transaction_type = 'purchase';

CREATE UNIQUE INDEX IF NOT EXISTS uq_org_wallet_txn_invoice_refund
  ON public.org_wallet_transactions (invoice_id)
  WHERE transaction_type = 'refund';

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_org_wallets_updated_at ON public.org_wallets;
CREATE TRIGGER trg_org_wallets_updated_at
BEFORE UPDATE ON public.org_wallets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.org_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Temporary permissive policies (will be replaced in hardening migration)
CREATE POLICY org_wallets_select_admin ON public.org_wallets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships om
      WHERE om.org_id = org_wallets.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY org_wallets_insert_system ON public.org_wallets
  FOR INSERT WITH CHECK (true);

CREATE POLICY org_wallets_update_system ON public.org_wallets
  FOR UPDATE USING (true);

CREATE POLICY org_wallet_transactions_select_admin ON public.org_wallet_transactions
  FOR SELECT TO authenticated
  USING (
    wallet_id IN (
      SELECT ow.id FROM public.org_wallets ow
      JOIN public.org_memberships om ON om.org_id = ow.org_id
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'editor')
    )
  );

CREATE POLICY org_wallet_transactions_insert_system ON public.org_wallet_transactions
  FOR INSERT WITH CHECK (true);

-- Basic helper functions
CREATE OR REPLACE FUNCTION public.ensure_org_wallet_exists(p_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_wallet_id UUID;
BEGIN
  SELECT id INTO v_wallet_id FROM public.org_wallets WHERE org_id = p_org_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.org_wallets (org_id) VALUES (p_org_id) RETURNING id INTO v_wallet_id;
  END IF;
  RETURN v_wallet_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recompute_org_wallet_balance(p_wallet_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_balance INT;
BEGIN
  SELECT COALESCE(SUM(credits_delta), 0) INTO new_balance
  FROM public.org_wallet_transactions WHERE wallet_id = p_wallet_id;
  
  UPDATE public.org_wallets
  SET balance_credits = new_balance, updated_at = now()
  WHERE id = p_wallet_id;
  
  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.org_wallet_apply_purchase(
  p_wallet_id UUID,
  p_credits INTEGER,
  p_invoice_id UUID,
  p_stripe_event_id TEXT,
  p_description TEXT DEFAULT 'Credit purchase'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_tx_id UUID;
BEGIN
  INSERT INTO public.org_wallet_transactions (
    wallet_id, credits_delta, transaction_type, description, invoice_id, stripe_event_id
  ) VALUES (
    p_wallet_id, p_credits, 'purchase', p_description, p_invoice_id, p_stripe_event_id
  ) RETURNING id INTO v_tx_id;

  UPDATE public.org_wallets
  SET balance_credits = balance_credits + p_credits, updated_at = now()
  WHERE id = p_wallet_id;

  RETURN v_tx_id;
END;
$$;

-- Add org_wallet_id to invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS org_wallet_id UUID REFERENCES public.org_wallets(id) ON DELETE SET NULL;

-- Add org_wallet_id to ad_spend_ledger table
ALTER TABLE public.ad_spend_ledger
  ADD COLUMN IF NOT EXISTS org_wallet_id UUID REFERENCES public.org_wallets(id) ON DELETE SET NULL;

-- Ensure ad_spend uses either user wallet or org wallet, not both
ALTER TABLE public.ad_spend_ledger
  ADD CONSTRAINT ad_spend_one_wallet_chk
  CHECK (
    (wallet_id IS NOT NULL AND org_wallet_id IS NULL)
    OR (wallet_id IS NULL AND org_wallet_id IS NOT NULL)
  );