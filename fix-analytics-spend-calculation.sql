-- Fix analytics views to include spend_accrual in spend calculation
-- This ensures fractional CPM charges show up before they reach 1.0 credit

-- Drop and recreate analytics_campaign_daily view
DROP VIEW IF EXISTS public.analytics_campaign_daily CASCADE;

CREATE OR REPLACE VIEW public.analytics_campaign_daily AS
SELECT
  c.id AS campaign_id,
  c.org_id,
  cd.day,
  COALESCE(imp.impressions, 0) AS impressions,
  COALESCE(clk.clicks, 0) AS clicks,
  COALESCE(conv.conversions, 0) AS conversions,
  -- FIX: Include spend_accrual in total spend
  COALESCE(c.spent_credits, 0) + COALESCE(c.spend_accrual, 0) AS spend_credits,
  CASE 
    WHEN COALESCE(imp.impressions, 0) > 0 
    THEN ROUND((COALESCE(clk.clicks, 0)::NUMERIC / imp.impressions) * 100, 2)
    ELSE 0
  END AS ctr,
  CASE 
    WHEN COALESCE(imp.impressions, 0) > 0
    THEN ROUND(((COALESCE(c.spent_credits, 0) + COALESCE(c.spend_accrual, 0)) / imp.impressions * 1000), 2)
    ELSE 0
  END AS ecpm,
  CASE 
    WHEN COALESCE(clk.clicks, 0) > 0
    THEN ROUND((COALESCE(c.spent_credits, 0) + COALESCE(c.spend_accrual, 0)) / clk.clicks, 2)
    ELSE 0
  END AS cpc
FROM campaigns.campaigns c
CROSS JOIN util.calendar_day cd
LEFT JOIN (
  SELECT
    campaign_id,
    DATE(created_at) AS day,
    COUNT(*) AS impressions
  FROM campaigns.ad_impressions
  GROUP BY campaign_id, DATE(created_at)
) imp ON imp.campaign_id = c.id AND imp.day = cd.day
LEFT JOIN (
  SELECT
    campaign_id,
    DATE(created_at) AS day,
    COUNT(*) AS clicks
  FROM campaigns.ad_clicks
  GROUP BY campaign_id, DATE(created_at)
) clk ON clk.campaign_id = c.id AND clk.day = cd.day
LEFT JOIN (
  SELECT
    campaign_id,
    DATE(occurred_at) AS day,
    COUNT(*) AS conversions
  FROM campaigns.ad_conversions
  GROUP BY campaign_id, DATE(occurred_at)
) conv ON conv.campaign_id = c.id AND conv.day = cd.day
WHERE cd.day >= c.start_date
  AND cd.day <= COALESCE(c.end_date, CURRENT_DATE)
  AND cd.day <= CURRENT_DATE;

-- Drop and recreate analytics_creative_daily view
DROP VIEW IF EXISTS public.analytics_creative_daily CASCADE;

CREATE OR REPLACE VIEW public.analytics_creative_daily AS
SELECT
  cr.campaign_id,
  cr.id AS creative_id,
  cr.headline AS creative_name,
  cd.day,
  COALESCE(imp.impressions, 0) AS impressions,
  COALESCE(clk.clicks, 0) AS clicks,
  COALESCE(conv.conversions, 0) AS conversions,
  CASE 
    WHEN COALESCE(imp.impressions, 0) > 0 
    THEN ROUND((COALESCE(clk.clicks, 0)::NUMERIC / imp.impressions) * 100, 2)
    ELSE 0
  END AS ctr
FROM campaigns.ad_creatives cr
CROSS JOIN util.calendar_day cd
INNER JOIN campaigns.campaigns c ON c.id = cr.campaign_id
LEFT JOIN (
  SELECT
    creative_id,
    DATE(created_at) AS day,
    COUNT(*) AS impressions
  FROM campaigns.ad_impressions
  WHERE creative_id IS NOT NULL
  GROUP BY creative_id, DATE(created_at)
) imp ON imp.creative_id = cr.id AND imp.day = cd.day
LEFT JOIN (
  SELECT
    creative_id,
    DATE(created_at) AS day,
    COUNT(*) AS clicks
  FROM campaigns.ad_clicks
  WHERE creative_id IS NOT NULL
  GROUP BY creative_id, DATE(created_at)
) clk ON clk.creative_id = cr.id AND clk.day = cd.day
LEFT JOIN (
  SELECT
    campaign_id,
    DATE(occurred_at) AS day,
    COUNT(*) AS conversions
  FROM campaigns.ad_conversions
  GROUP BY campaign_id, DATE(occurred_at)
) conv ON conv.campaign_id = cr.campaign_id AND conv.day = cd.day
WHERE cd.day >= c.start_date
  AND cd.day <= COALESCE(c.end_date, CURRENT_DATE)
  AND cd.day <= CURRENT_DATE;

-- Recreate materialized view with fixed spend calculation
DROP MATERIALIZED VIEW IF EXISTS public.analytics_campaign_daily_mv CASCADE;

CREATE MATERIALIZED VIEW public.analytics_campaign_daily_mv AS
SELECT * FROM public.analytics_campaign_daily;

-- Add unique index for concurrent refresh
CREATE UNIQUE INDEX idx_acdmv_campaign_day_unique
  ON public.analytics_campaign_daily_mv(campaign_id, day);

-- Refresh the materialized view with new data
REFRESH MATERIALIZED VIEW CONCURRENTLY public.analytics_campaign_daily_mv;

-- Grant permissions
GRANT SELECT ON public.analytics_campaign_daily TO authenticated, anon;
GRANT SELECT ON public.analytics_creative_daily TO authenticated, anon;
GRANT SELECT ON public.analytics_campaign_daily_mv TO authenticated, anon;

-- Verify the fix
SELECT 
  campaign_id,
  day,
  impressions,
  clicks,
  spend_credits, -- Should now show 0.5!
  ctr,
  ecpm,
  cpc
FROM public.analytics_campaign_daily
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC
LIMIT 7;




