-- ============================================================
-- Create Organization Wallet Transactions Table
-- ============================================================
-- Tracks all credit transactions for organization wallets

CREATE TABLE IF NOT EXISTS organizations.org_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES organizations.org_wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'refund', 'spend', 'adjustment')),
  credits_delta INTEGER NOT NULL, -- Positive for additions, negative for subtractions
  usd_cents INTEGER, -- Amount in cents (for purchases/refunds)
  reference_type TEXT, -- 'invoice', 'campaign', 'adjustment', etc.
  reference_id UUID, -- ID of the related entity
  memo TEXT, -- Human-readable description
  idempotency_key TEXT UNIQUE, -- Stripe event ID or other unique key for deduplication
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_org_wallet_transactions_wallet_id 
  ON organizations.org_wallet_transactions(wallet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_wallet_transactions_type 
  ON organizations.org_wallet_transactions(type);

CREATE INDEX IF NOT EXISTS idx_org_wallet_transactions_reference 
  ON organizations.org_wallet_transactions(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_org_wallet_transactions_idempotency 
  ON organizations.org_wallet_transactions(idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

-- Enable RLS
ALTER TABLE organizations.org_wallet_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view transactions for their org's wallet
CREATE POLICY "Users can view their org wallet transactions"
  ON organizations.org_wallet_transactions
  FOR SELECT
  USING (
    wallet_id IN (
      SELECT id FROM organizations.org_wallets
      WHERE org_id IN (
        SELECT org_id FROM organizations.org_memberships 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Grant permissions
GRANT SELECT ON organizations.org_wallet_transactions TO authenticated;
GRANT SELECT ON organizations.org_wallet_transactions TO service_role;

-- Add comment
COMMENT ON TABLE organizations.org_wallet_transactions IS 'Tracks all credit transactions for organization wallets (purchases, refunds, spends, adjustments)';

-- ============================================================
-- Create Public View for API Access
-- ============================================================

CREATE OR REPLACE VIEW public.org_wallet_transactions AS
SELECT 
  id,
  wallet_id,
  type,
  credits_delta,
  usd_cents,
  reference_type,
  reference_id,
  memo,
  idempotency_key,
  created_at
FROM organizations.org_wallet_transactions;

COMMENT ON VIEW public.org_wallet_transactions IS 'Public view of organizations.org_wallet_transactions for API access';

-- Grant access
GRANT SELECT ON public.org_wallet_transactions TO authenticated;

-- Enable RLS on view (inherits from base table)
-- No need for separate RLS policies on the view

