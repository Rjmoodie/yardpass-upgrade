-- ========================================
-- FIX: analytics_campaign_daily to show DAILY spend, not cumulative
-- ========================================
-- Problem: The view currently shows campaign.spent_credits (total) on every row
-- Solution: Calculate daily spend from impression/click costs for that day

-- Drop the existing view
DROP VIEW IF EXISTS public.analytics_campaign_daily CASCADE;

-- Recreate with correct daily spend calculation
CREATE OR REPLACE VIEW public.analytics_campaign_daily AS
SELECT 
  c.id AS campaign_id,
  c.org_id,
  cd.day,
  COALESCE(imp.impressions, 0) AS impressions,
  COALESCE(clk.clicks, 0) AS clicks,
  COALESCE(conv.conversions, 0) AS conversions,
  
  -- ✅ FIXED: Calculate actual daily spend from events on that day
  -- Get spend from the ledger for this specific day
  COALESCE(ledger.daily_spend, 0) AS spend_credits,
  
  -- CTR: clicks / impressions * 100
  CASE
    WHEN COALESCE(imp.impressions, 0) > 0 
    THEN ROUND(COALESCE(clk.clicks, 0)::NUMERIC / imp.impressions::NUMERIC * 100, 2)
    ELSE 0
  END AS ctr,
  
  -- eCPM: spend / impressions * 1000
  CASE
    WHEN COALESCE(imp.impressions, 0) > 0 
    THEN ROUND(COALESCE(ledger.daily_spend, 0) / imp.impressions::NUMERIC * 1000, 2)
    ELSE 0
  END AS ecpm,
  
  -- CPC: spend / clicks
  CASE
    WHEN COALESCE(clk.clicks, 0) > 0 
    THEN ROUND(COALESCE(ledger.daily_spend, 0) / clk.clicks::NUMERIC, 2)
    ELSE 0
  END AS cpc

FROM campaigns.campaigns c
CROSS JOIN util.calendar_day cd

-- Daily impressions
LEFT JOIN (
  SELECT 
    campaign_id,
    DATE(created_at) AS day,
    COUNT(*) AS impressions
  FROM campaigns.ad_impressions
  GROUP BY campaign_id, DATE(created_at)
) imp ON imp.campaign_id = c.id AND imp.day = cd.day

-- Daily clicks
LEFT JOIN (
  SELECT 
    campaign_id,
    DATE(created_at) AS day,
    COUNT(*) AS clicks
  FROM campaigns.ad_clicks
  GROUP BY campaign_id, DATE(created_at)
) clk ON clk.campaign_id = c.id AND clk.day = cd.day

-- Daily conversions
LEFT JOIN (
  SELECT 
    campaign_id,
    DATE(occurred_at) AS day,
    COUNT(*) AS conversions
  FROM campaigns.ad_conversions
  GROUP BY campaign_id, DATE(occurred_at)
) conv ON conv.campaign_id = c.id AND conv.day = cd.day

-- ✅ Daily spend from ledger (this is the key fix!)
LEFT JOIN (
  SELECT 
    campaign_id,
    DATE(occurred_at) AS day,
    SUM(credits_charged) AS daily_spend
  FROM campaigns.ad_spend_ledger
  GROUP BY campaign_id, DATE(occurred_at)
) ledger ON ledger.campaign_id = c.id AND ledger.day = cd.day

WHERE 
  cd.day >= c.start_date 
  AND cd.day <= COALESCE(c.end_date, CURRENT_DATE)
  AND cd.day <= CURRENT_DATE;

-- Grant access
GRANT SELECT ON public.analytics_campaign_daily TO authenticated, anon;

-- ========================================
-- Verify the fix
-- ========================================
SELECT 
  day,
  impressions,
  clicks,
  spend_credits,
  ctr,
  ecpm,
  cpc
FROM public.analytics_campaign_daily
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC;

