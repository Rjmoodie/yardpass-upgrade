-- ============================================================
-- Fix org_wallets Access with RLS Policies
-- ============================================================

-- Enable RLS on org_wallets if not already enabled
ALTER TABLE organizations.org_wallets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their org wallets" ON organizations.org_wallets;
DROP POLICY IF EXISTS "Users can update their org wallets" ON organizations.org_wallets;

-- Create RLS policy for viewing org wallets
CREATE POLICY "Users can view their org wallets"
  ON organizations.org_wallets
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM organizations.org_memberships 
      WHERE user_id = auth.uid()
    )
  );

-- Create RLS policy for updating org wallets (needed for balance updates)
CREATE POLICY "Service role can update org wallets"
  ON organizations.org_wallets
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON organizations.org_wallets TO authenticated;
GRANT SELECT, UPDATE ON organizations.org_wallets TO service_role;

-- ============================================================
-- Recreate the public view properly
-- ============================================================

DROP VIEW IF EXISTS public.org_wallets CASCADE;

CREATE VIEW public.org_wallets AS
SELECT 
  id,
  org_id,
  balance_credits,
  low_balance_threshold,
  auto_reload_enabled,
  auto_reload_topup_credits,
  status,
  created_at,
  updated_at
FROM organizations.org_wallets;

-- Grant permissions on the view
GRANT SELECT ON public.org_wallets TO authenticated;
GRANT SELECT ON public.org_wallets TO anon;

COMMENT ON VIEW public.org_wallets IS 'Public view of organizations.org_wallets for API access';

