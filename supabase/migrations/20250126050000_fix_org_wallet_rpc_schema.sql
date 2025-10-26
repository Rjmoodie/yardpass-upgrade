-- ============================================================
-- Update Organization Wallet RPC Functions to Match Existing Schema
-- ============================================================

-- Drop and recreate the purchase function
DROP FUNCTION IF EXISTS organizations.org_wallet_apply_purchase(UUID, INTEGER, UUID, TEXT, TEXT);

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

  -- Create transaction record using existing schema
  INSERT INTO organizations.org_wallet_transactions (
    wallet_id,
    transaction_type,
    credits_delta,
    description,
    reference_type,
    reference_id,
    invoice_id,
    stripe_event_id
  ) VALUES (
    p_wallet_id,
    'purchase',
    p_credits,
    p_description,
    'invoice',
    p_invoice_id,
    p_invoice_id,
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

-- Drop and recreate the refund function
DROP FUNCTION IF EXISTS organizations.org_wallet_apply_refund(UUID, INTEGER, UUID, TEXT, TEXT);

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

  -- Create transaction record (negative delta) using existing schema
  INSERT INTO organizations.org_wallet_transactions (
    wallet_id,
    transaction_type,
    credits_delta,
    description,
    reference_type,
    reference_id,
    invoice_id,
    stripe_event_id
  ) VALUES (
    p_wallet_id,
    'refund',
    -p_refund_credits,
    p_description,
    'invoice',
    p_invoice_id,
    p_invoice_id,
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

-- Freeze function stays the same
DROP FUNCTION IF EXISTS organizations.org_wallet_freeze_if_negative(UUID);

CREATE OR REPLACE FUNCTION organizations.org_wallet_freeze_if_negative(
  p_wallet_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE organizations.org_wallets
  SET 
    status = 'frozen',
    updated_at = now()
  WHERE id = p_wallet_id
    AND balance_credits < 0
    AND status != 'frozen';
END;
$$;

COMMENT ON FUNCTION organizations.org_wallet_freeze_if_negative IS 'Freeze an org wallet if balance is negative';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION organizations.org_wallet_apply_purchase TO service_role;
GRANT EXECUTE ON FUNCTION organizations.org_wallet_apply_refund TO service_role;
GRANT EXECUTE ON FUNCTION organizations.org_wallet_freeze_if_negative TO service_role;

