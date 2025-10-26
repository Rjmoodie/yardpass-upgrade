-- ============================================================
-- Create RPC helper functions for accessing org wallet data
-- ============================================================

-- Function to get org wallet by org_id
CREATE OR REPLACE FUNCTION public.get_org_wallet_by_org_id(p_org_id UUID)
RETURNS TABLE (
  id UUID,
  org_id UUID,
  balance_credits INTEGER,
  low_balance_threshold INTEGER,
  auto_reload_enabled BOOLEAN,
  auto_reload_topup_credits INTEGER,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id,
    w.org_id,
    w.balance_credits,
    w.low_balance_threshold,
    w.auto_reload_enabled,
    w.auto_reload_topup_credits,
    w.status,
    w.created_at,
    w.updated_at
  FROM organizations.org_wallets w
  WHERE w.org_id = p_org_id;
END;
$$;

-- Function to get org wallet transactions
CREATE OR REPLACE FUNCTION public.get_org_wallet_transactions(
  p_wallet_id UUID,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  wallet_id UUID,
  credits_delta INTEGER,
  transaction_type TEXT,
  description TEXT,
  reference_type TEXT,
  reference_id UUID,
  invoice_id UUID,
  stripe_event_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.wallet_id,
    t.credits_delta,
    t.transaction_type,
    t.description,
    t.reference_type,
    t.reference_id,
    t.invoice_id,
    t.stripe_event_id,
    t.metadata,
    t.created_at
  FROM organizations.org_wallet_transactions t
  WHERE t.wallet_id = p_wallet_id
  ORDER BY t.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_org_wallet_by_org_id(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_org_wallet_transactions(UUID, INTEGER) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.get_org_wallet_by_org_id IS 'Helper function to access organizations.org_wallets from edge functions';
COMMENT ON FUNCTION public.get_org_wallet_transactions IS 'Helper function to access organizations.org_wallet_transactions from edge functions';

