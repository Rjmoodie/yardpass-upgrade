-- Fix RLS policy for ad_creatives to allow 'member' role to create creatives
-- Currently only 'owner', 'admin', 'editor' can create, but members should also be able to

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can create ad creatives" ON campaigns.ad_creatives;

-- Recreate with less restrictive role check - allow any org member to create creatives
CREATE POLICY "Users can create ad creatives"
  ON campaigns.ad_creatives
  FOR INSERT
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaigns.campaigns
      WHERE org_id IN (
        SELECT org_id FROM organizations.org_memberships 
        WHERE user_id = auth.uid()
        -- Removed role restriction - any org member can create creatives
      )
    )
  );

-- Also add an UPDATE policy for members to edit their creatives
DROP POLICY IF EXISTS "Users can update their ad creatives" ON campaigns.ad_creatives;

CREATE POLICY "Users can update their ad creatives"
  ON campaigns.ad_creatives
  FOR UPDATE
  USING (
    campaign_id IN (
      SELECT id FROM campaigns.campaigns
      WHERE org_id IN (
        SELECT org_id FROM organizations.org_memberships 
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaigns.campaigns
      WHERE org_id IN (
        SELECT org_id FROM organizations.org_memberships 
        WHERE user_id = auth.uid()
      )
    )
  );

-- Add DELETE policy
DROP POLICY IF EXISTS "Users can delete their ad creatives" ON campaigns.ad_creatives;

CREATE POLICY "Users can delete their ad creatives"
  ON campaigns.ad_creatives
  FOR DELETE
  USING (
    campaign_id IN (
      SELECT id FROM campaigns.campaigns
      WHERE org_id IN (
        SELECT org_id FROM organizations.org_memberships 
        WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin', 'editor')  -- Only elevated roles can delete
      )
    )
  );

COMMENT ON POLICY "Users can create ad creatives" ON campaigns.ad_creatives IS 
  'Any organization member can create ad creatives for campaigns in their org';

COMMENT ON POLICY "Users can update their ad creatives" ON campaigns.ad_creatives IS 
  'Any organization member can update ad creatives for campaigns in their org';

COMMENT ON POLICY "Users can delete their ad creatives" ON campaigns.ad_creatives IS 
  'Only owners, admins, and editors can delete ad creatives';

