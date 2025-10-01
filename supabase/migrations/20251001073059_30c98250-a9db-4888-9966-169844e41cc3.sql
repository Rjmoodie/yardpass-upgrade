-- ============================
-- Harden org_wallets security
-- ============================

-- 0) Safety: ensure RLS is ON
ALTER TABLE public.org_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- 1) Drop permissive write policies
DROP POLICY IF EXISTS org_wallets_insert_system ON public.org_wallets;
DROP POLICY IF EXISTS org_wallets_update_system ON public.org_wallets;
DROP POLICY IF EXISTS org_wallet_transactions_insert_system ON public.org_wallet_transactions;

-- 2) Tighten read policies (add 'viewer' role)
DROP POLICY IF EXISTS org_wallets_select_admin ON public.org_wallets;
CREATE POLICY org_wallets_select_member
ON public.org_wallets
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.org_memberships om
    WHERE om.org_id = org_wallets.org_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner','admin','editor','viewer')
  )
);

DROP POLICY IF EXISTS org_wallet_transactions_select_admin ON public.org_wallet_transactions;
CREATE POLICY org_wallet_transactions_select_member
ON public.org_wallet_transactions
FOR SELECT TO authenticated
USING (
  wallet_id IN (
    SELECT ow.id
    FROM public.org_wallets ow
    JOIN public.org_memberships om ON om.org_id = ow.org_id
    WHERE om.user_id = auth.uid()
  )
);

-- 3) Hardened ensure function (owners/admins only)
CREATE OR REPLACE FUNCTION public.ensure_org_wallet_exists(p_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.org_memberships om
    WHERE om.org_id = p_org_id
      AND om.user_id = v_uid
      AND om.role IN ('owner','admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id INTO v_wallet_id FROM public.org_wallets WHERE org_id = p_org_id;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.org_wallets (org_id) VALUES (p_org_id) RETURNING id INTO v_wallet_id;
  END IF;

  RETURN v_wallet_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_org_wallet_exists(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_org_wallet_exists(UUID) TO authenticated;

-- 4) Atomic purchase with row lock + idempotency
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
DECLARE
  v_tx_id UUID;
BEGIN
  IF p_credits <= 0 THEN RAISE EXCEPTION 'credits must be positive'; END IF;

  -- Idempotency
  IF p_stripe_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.org_wallet_transactions WHERE stripe_event_id = p_stripe_event_id
  ) THEN
    SELECT id INTO v_tx_id FROM public.org_wallet_transactions WHERE stripe_event_id = p_stripe_event_id;
    RETURN v_tx_id;
  END IF;

  -- Lock wallet row
  PERFORM 1 FROM public.org_wallets WHERE id = p_wallet_id FOR UPDATE;

  -- Ledger
  INSERT INTO public.org_wallet_transactions (
    wallet_id, credits_delta, transaction_type, description, invoice_id, stripe_event_id
  ) VALUES (
    p_wallet_id, p_credits, 'purchase', p_description, p_invoice_id, p_stripe_event_id
  ) RETURNING id INTO v_tx_id;

  -- Balance
  UPDATE public.org_wallets
     SET balance_credits = balance_credits + p_credits,
         updated_at = now()
   WHERE id = p_wallet_id;

  RETURN v_tx_id;
END;
$$;
REVOKE ALL ON FUNCTION public.org_wallet_apply_purchase(UUID,INTEGER,UUID,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_wallet_apply_purchase(UUID,INTEGER,UUID,TEXT,TEXT) TO authenticated;

-- 5) Freeze helper
CREATE OR REPLACE FUNCTION public.org_wallet_freeze_if_negative(p_wallet_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_bal INT;
BEGIN
  SELECT balance_credits INTO v_bal FROM public.org_wallets WHERE id = p_wallet_id;
  IF v_bal < 0 THEN
    UPDATE public.org_wallets SET status = 'frozen', updated_at = now() WHERE id = p_wallet_id;
  END IF;
END;
$$;