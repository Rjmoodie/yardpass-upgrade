-- ============================================================
-- Create Public View for campaigns.campaigns Table
-- ============================================================
-- Purpose: Expose campaigns.campaigns via public schema view
--          for PostgREST API access
-- ============================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.campaigns CASCADE;

-- Create campaigns view
CREATE VIEW public.campaigns AS
SELECT 
  id,
  org_id,
  name,
  description,
  objective,
  status,
  pacing_strategy,
  total_budget_credits,
  daily_budget_credits,
  spent_credits,
  start_date,
  end_date,
  timezone,
  created_by,
  created_at,
  updated_at,
  pricing_model
FROM campaigns.campaigns;

COMMENT ON VIEW public.campaigns IS 'Public view of campaigns.campaigns for API access';

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;

-- Enable RLS on the underlying table
ALTER TABLE campaigns.campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view campaigns for orgs they're members of
DROP POLICY IF EXISTS "Users can view org campaigns" ON campaigns.campaigns;
CREATE POLICY "Users can view org campaigns"
  ON campaigns.campaigns
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM organizations.org_memberships 
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Users can create campaigns for their orgs
DROP POLICY IF EXISTS "Users can create campaigns" ON campaigns.campaigns;
CREATE POLICY "Users can create campaigns"
  ON campaigns.campaigns
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organizations.org_memberships 
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'editor')
    )
  );

-- RLS Policy: Users can update campaigns for their orgs
DROP POLICY IF EXISTS "Users can update campaigns" ON campaigns.campaigns;
CREATE POLICY "Users can update campaigns"
  ON campaigns.campaigns
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM organizations.org_memberships 
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'editor')
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM organizations.org_memberships 
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'editor')
    )
  );

-- RLS Policy: Users can delete/archive campaigns for their orgs
DROP POLICY IF EXISTS "Users can delete campaigns" ON campaigns.campaigns;
CREATE POLICY "Users can delete campaigns"
  ON campaigns.campaigns
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM organizations.org_memberships 
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- Performance Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_campaigns_org_id_created 
  ON campaigns.campaigns(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaigns_status 
  ON campaigns.campaigns(status) 
  WHERE status IN ('active', 'scheduled');

CREATE INDEX IF NOT EXISTS idx_campaigns_dates 
  ON campaigns.campaigns(start_date, end_date);

-- ============================================================
-- Done! Campaigns now accessible via public.campaigns view
-- ============================================================






