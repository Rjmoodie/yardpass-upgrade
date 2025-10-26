-- ============================================================
-- Create Organization Wallet RPC Functions
-- ============================================================
-- These functions handle atomic wallet operations for credit purchases,
-- refunds, and balance management

-- ============================================================
-- 1. org_wallet_apply_purchase
-- ============================================================
-- Atomically applies a credit purchase to an org wallet

CREATE OR REPLACE FUNCTION organizations.org_wallet_apply_purchase(
  p_wallet_id UUID,
  p_credits INTEGER,
  p_invoice_id UUID,
  p_stripe_event_id TEXT,
  p_description TEXT DEFAULT 'Credit purchase'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update wallet balance
  UPDATE organizations.org_wallets
  SET 
    balance_credits = balance_credits + p_credits,
    updated_at = now()
  WHERE id = p_wallet_id;

  -- Create transaction record
  INSERT INTO organizations.org_wallet_transactions (
    wallet_id,
    type,
    credits_delta,
    usd_cents,
    reference_type,
    reference_id,
    memo,
    idempotency_key
  ) VALUES (
    p_wallet_id,
    'purchase',
    p_credits,
    p_credits, -- 1 credit = 1 cent
    'invoice',
    p_invoice_id,
    p_description,
    p_stripe_event_id
  );

  -- Mark invoice as completed
  UPDATE organizations.invoices
  SET 
    status = 'completed',
    completed_at = now(),
    updated_at = now()
  WHERE id = p_invoice_id;

  RAISE NOTICE 'Applied purchase: +% credits to wallet %', p_credits, p_wallet_id;
END;
$$;

COMMENT ON FUNCTION organizations.org_wallet_apply_purchase IS 'Atomically apply a credit purchase to an org wallet';

GRANT EXECUTE ON FUNCTION organizations.org_wallet_apply_purchase TO service_role;

-- ============================================================
-- 2. org_wallet_apply_refund
-- ============================================================
-- Atomically applies a refund to an org wallet

CREATE OR REPLACE FUNCTION organizations.org_wallet_apply_refund(
  p_wallet_id UUID,
  p_refund_credits INTEGER,
  p_invoice_id UUID,
  p_stripe_event_id TEXT,
  p_description TEXT DEFAULT 'Refund'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update wallet balance (subtract credits)
  UPDATE organizations.org_wallets
  SET 
    balance_credits = balance_credits - p_refund_credits,
    updated_at = now()
  WHERE id = p_wallet_id;

  -- Create transaction record (negative delta)
  INSERT INTO organizations.org_wallet_transactions (
    wallet_id,
    type,
    credits_delta,
    usd_cents,
    reference_type,
    reference_id,
    memo,
    idempotency_key
  ) VALUES (
    p_wallet_id,
    'refund',
    -p_refund_credits,
    -p_refund_credits, -- negative
    'invoice',
    p_invoice_id,
    p_description,
    p_stripe_event_id
  );

  -- Mark invoice as refunded
  UPDATE organizations.invoices
  SET 
    status = 'refunded',
    updated_at = now()
  WHERE id = p_invoice_id;

  RAISE NOTICE 'Applied refund: -% credits from wallet %', p_refund_credits, p_wallet_id;
END;
$$;

COMMENT ON FUNCTION organizations.org_wallet_apply_refund IS 'Atomically apply a refund to an org wallet';

GRANT EXECUTE ON FUNCTION organizations.org_wallet_apply_refund TO service_role;

-- ============================================================
-- 3. org_wallet_freeze_if_negative
-- ============================================================
-- Freezes an org wallet if balance is negative

CREATE OR REPLACE FUNCTION organizations.org_wallet_freeze_if_negative(
  p_wallet_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT balance_credits INTO v_balance
  FROM organizations.org_wallets
  WHERE id = p_wallet_id;

  IF v_balance < 0 THEN
    UPDATE organizations.org_wallets
    SET status = 'frozen', updated_at = now()
    WHERE id = p_wallet_id;
    
    RAISE NOTICE 'Wallet % frozen due to negative balance: %', p_wallet_id, v_balance;
  END IF;
END;
$$;

COMMENT ON FUNCTION organizations.org_wallet_freeze_if_negative IS 'Freeze wallet if balance is negative';

GRANT EXECUTE ON FUNCTION organizations.org_wallet_freeze_if_negative TO service_role;

-- ============================================================
-- 4. ensure_org_wallet_exists
-- ============================================================
-- Ensures an org wallet exists for the given org_id
-- Called by purchase flow to create wallet if needed

CREATE OR REPLACE FUNCTION public.ensure_org_wallet_exists(
  p_org_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
  v_user_id UUID;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user is a member of the organization
  IF NOT EXISTS (
    SELECT 1 FROM organizations.org_memberships
    WHERE org_id = p_org_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of organization %', p_org_id;
  END IF;

  -- Try to get existing wallet
  SELECT id INTO v_wallet_id
  FROM organizations.org_wallets
  WHERE org_id = p_org_id;

  -- Create wallet if it doesn't exist
  IF v_wallet_id IS NULL THEN
    INSERT INTO organizations.org_wallets (
      org_id,
      balance_credits,
      low_balance_threshold,
      auto_reload_enabled,
      status
    ) VALUES (
      p_org_id,
      0,
      1000,
      false,
      'active'
    )
    RETURNING id INTO v_wallet_id;
    
    RAISE NOTICE 'Created new org wallet % for org %', v_wallet_id, p_org_id;
  END IF;

  RETURN v_wallet_id;
END;
$$;

COMMENT ON FUNCTION public.ensure_org_wallet_exists IS 'Ensure org wallet exists and return its ID';

GRANT EXECUTE ON FUNCTION public.ensure_org_wallet_exists TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_org_wallet_exists TO service_role;

