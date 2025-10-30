-- ========================================
-- FIX: campaigns_overview to use correct spent_credits
-- ========================================
-- Problem: campaigns_overview was prioritizing ledger data which wasn't being updated
-- Solution: Use campaigns.spent_credits as source of truth

-- Drop and recreate the view with correct spent_credits
DROP VIEW IF EXISTS public.campaigns_overview CASCADE;

CREATE OR REPLACE VIEW public.campaigns_overview AS
SELECT 
  base.id,
  base.org_id,
  base.name,
  base.status,
  base.start_date,
  base.end_date,
  base.total_budget_credits,
  base.daily_budget_credits,
  base.bidding,
  base.freq_cap,
  base.targeting,
  base.created_at,
  base.updated_at,
  
  -- ✅ FIXED: Use base.spent_credits as source of truth
  base.spent_credits,  -- Source of truth from campaigns table
  
  -- Activity tracking
  GREATEST(
    base.updated_at,
    COALESCE(imp.last_impression, base.created_at),
    COALESCE(clk.last_click, base.created_at)
  ) AS last_activity_at,
  
  -- Aggregated stats
  COALESCE(imp.total_impressions, 0) AS total_impressions,
  COALESCE(clk.total_clicks, 0) AS total_clicks,
  COALESCE(conv.total_conversions, 0) AS total_conversions

FROM campaigns.campaigns base

-- Impression aggregates
LEFT JOIN (
  SELECT 
    campaign_id,
    COUNT(*) AS total_impressions,
    MAX(created_at) AS last_impression
  FROM campaigns.ad_impressions
  GROUP BY campaign_id
) imp ON imp.campaign_id = base.id

-- Click aggregates  
LEFT JOIN (
  SELECT 
    campaign_id,
    COUNT(*) AS total_clicks,
    MAX(created_at) AS last_click
  FROM campaigns.ad_clicks
  GROUP BY campaign_id
) clk ON clk.campaign_id = base.id

-- Conversion aggregates
LEFT JOIN (
  SELECT 
    campaign_id,
    COUNT(*) AS total_conversions
  FROM campaigns.ad_conversions
  GROUP BY campaign_id
) conv ON conv.campaign_id = base.id;

-- Creative count (removed - table doesn't exist yet)
-- LEFT JOIN (
--   SELECT 
--     campaign_id,
--     COUNT(*) AS creative_count
--   FROM campaigns.creatives
--   GROUP BY campaign_id
-- ) creatives ON creatives.campaign_id = base.id;

-- Grant access
GRANT SELECT ON public.campaigns_overview TO authenticated, anon;

-- ========================================
-- Verify the fix
-- ========================================
SELECT 
  id,
  name,
  total_budget_credits,
  spent_credits,
  total_impressions,
  total_clicks,
  total_conversions
FROM public.campaigns_overview
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

