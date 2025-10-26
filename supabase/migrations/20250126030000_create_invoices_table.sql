-- ============================================================
-- Create Invoices Table for Wallet Credit Purchases
-- ============================================================

-- Create invoices table in campaigns schema
CREATE TABLE IF NOT EXISTS campaigns.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_wallet_id UUID REFERENCES campaigns.org_wallets(id) ON DELETE CASCADE,
  wallet_id UUID, -- Legacy field for user wallets (may not be used)
  amount_usd_cents INTEGER NOT NULL CHECK (amount_usd_cents >= 0),
  credits_purchased INTEGER NOT NULL CHECK (credits_purchased > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  promo_code TEXT,
  tax_usd_cents INTEGER DEFAULT 0,
  purchased_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE campaigns.invoices IS 'Invoices for wallet credit purchases';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_org_wallet_id 
  ON campaigns.invoices(org_wallet_id);

CREATE INDEX IF NOT EXISTS idx_invoices_purchased_by_user_id 
  ON campaigns.invoices(purchased_by_user_id);

CREATE INDEX IF NOT EXISTS idx_invoices_status 
  ON campaigns.invoices(status);

CREATE INDEX IF NOT EXISTS idx_invoices_stripe_payment_intent_id 
  ON campaigns.invoices(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_invoices_created_at 
  ON campaigns.invoices(created_at DESC);

-- Create public view for API access
DROP VIEW IF EXISTS public.invoices CASCADE;

CREATE VIEW public.invoices AS
SELECT 
  id,
  org_wallet_id,
  wallet_id,
  amount_usd_cents,
  credits_purchased,
  status,
  promo_code,
  tax_usd_cents,
  purchased_by_user_id,
  stripe_payment_intent_id,
  stripe_invoice_id,
  receipt_url,
  created_at,
  updated_at,
  completed_at,
  metadata
FROM campaigns.invoices;

COMMENT ON VIEW public.invoices IS 'Public view of campaigns.invoices for API access';

-- Grant permissions
GRANT SELECT ON public.invoices TO authenticated;
GRANT INSERT ON public.invoices TO authenticated;
GRANT UPDATE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO service_role;

-- Enable RLS
ALTER TABLE campaigns.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view invoices for their organization's wallet
CREATE POLICY "Users can view their org's invoices"
  ON campaigns.invoices
  FOR SELECT
  USING (
    org_wallet_id IN (
      SELECT id FROM campaigns.org_wallets
      WHERE org_id IN (
        SELECT org_id FROM organizations.org_memberships 
        WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policy: Service role can do everything
CREATE POLICY "Service role can manage all invoices"
  ON campaigns.invoices
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION campaigns.update_invoices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS invoices_updated_at_trigger ON campaigns.invoices;
CREATE TRIGGER invoices_updated_at_trigger
  BEFORE UPDATE ON campaigns.invoices
  FOR EACH ROW
  EXECUTE FUNCTION campaigns.update_invoices_updated_at();

