-- =====================================================
-- FIX SPEND ACCRUAL DUPLICATION
-- =====================================================
-- Problem: spend_accrual is being added to every day
-- in the campaign range, creating phantom rows
-- 
-- Solution: Only add spend_accrual to the current date
-- =====================================================

DROP MATERIALIZED VIEW IF EXISTS public.analytics_campaign_daily_mv CASCADE;

CREATE MATERIALIZED VIEW public.analytics_campaign_daily_mv AS
WITH daily_stats AS (
  SELECT
    c.id AS campaign_id,
    c.org_id,
    d.day,
    
    -- Core metrics
    COALESCE(imp.impressions, 0) AS impressions,
    COALESCE(clk.clicks, 0) AS clicks,
    COALESCE(conv.conversions, 0) AS conversions,
    -- FIX: Only add spend_accrual to current date
    COALESCE(spend.spend_credits, 0) + 
      CASE WHEN d.day = CURRENT_DATE THEN COALESCE(c.spend_accrual, 0) ELSE 0 END AS spend_credits,
    COALESCE(conv.revenue_cents, 0) AS conversion_value_cents,
    
    -- Attribution breakdown
    COALESCE(conv.click_conversions, 0) AS click_conversions,
    COALESCE(conv.view_conversions, 0) AS view_conversions,
    
    -- Engagement metrics
    COALESCE(imp.viewable_impressions, 0) AS viewable_impressions,
    COALESCE(imp.avg_dwell_ms, 0) AS avg_dwell_ms
    
  FROM campaigns.campaigns c
  CROSS JOIN util.calendar_day d
  
  -- Impressions
  LEFT JOIN (
    SELECT 
      campaign_id,
      DATE(created_at AT TIME ZONE 'UTC') AS day,
      COUNT(*) AS impressions,
      COUNT(*) FILTER (WHERE viewable = true) AS viewable_impressions,
      AVG(dwell_ms) AS avg_dwell_ms
    FROM campaigns.ad_impressions
    GROUP BY campaign_id, DATE(created_at AT TIME ZONE 'UTC')
  ) imp ON imp.campaign_id = c.id AND imp.day = d.day
  
  -- Clicks
  LEFT JOIN (
    SELECT 
      campaign_id,
      DATE(created_at AT TIME ZONE 'UTC') AS day,
      COUNT(*) AS clicks
    FROM campaigns.ad_clicks
    GROUP BY campaign_id, DATE(created_at AT TIME ZONE 'UTC')
  ) clk ON clk.campaign_id = c.id AND clk.day = d.day
  
  -- Conversions with attribution breakdown
  LEFT JOIN (
    SELECT 
      COALESCE(i.campaign_id, c.campaign_id) AS campaign_id,
      DATE(conv.occurred_at AT TIME ZONE 'UTC') AS day,
      COUNT(*) AS conversions,
      SUM(conv.value_cents) AS revenue_cents,
      COUNT(*) FILTER (WHERE conv.attribution_model = 'last_click_7d') AS click_conversions,
      COUNT(*) FILTER (WHERE conv.attribution_model = 'view_through_1d') AS view_conversions
    FROM campaigns.ad_conversions conv
    LEFT JOIN campaigns.ad_clicks c ON c.id = conv.click_id
    LEFT JOIN campaigns.ad_impressions i ON i.id = conv.impression_id
    GROUP BY COALESCE(i.campaign_id, c.campaign_id), DATE(conv.occurred_at AT TIME ZONE 'UTC')
  ) conv ON conv.campaign_id = c.id AND conv.day = d.day
  
  -- Spend
  LEFT JOIN (
    SELECT 
      campaign_id,
      DATE(occurred_at AT TIME ZONE 'UTC') AS day,
      SUM(credits_charged) AS spend_credits
    FROM campaigns.ad_spend_ledger
    GROUP BY campaign_id, DATE(occurred_at AT TIME ZONE 'UTC')
  ) spend ON spend.campaign_id = c.id AND spend.day = d.day
  
  WHERE d.day >= c.start_date::DATE
    AND d.day <= COALESCE(c.end_date::DATE, CURRENT_DATE + INTERVAL '1 year')
)
SELECT
  campaign_id,
  org_id,
  day,
  
  -- Core metrics
  impressions,
  clicks,
  conversions,
  spend_credits,
  conversion_value_cents,
  
  -- Attribution
  click_conversions,
  view_conversions,
  
  -- Engagement
  viewable_impressions,
  avg_dwell_ms,
  
  -- Computed metrics (avoiding division by zero)
  CASE 
    WHEN impressions > 0 THEN ROUND((clicks::NUMERIC / impressions::NUMERIC) * 100, 2)
    ELSE 0
  END AS ctr,
  
  CASE 
    WHEN clicks > 0 THEN ROUND((conversions::NUMERIC / clicks::NUMERIC) * 100, 2)
    ELSE 0
  END AS cvr,
  
  CASE 
    WHEN impressions > 0 THEN ROUND((spend_credits::NUMERIC / impressions::NUMERIC) * 1000, 2)
    ELSE 0
  END AS cpm,
  
  CASE 
    WHEN clicks > 0 THEN ROUND(spend_credits::NUMERIC / clicks::NUMERIC, 2)
    ELSE 0
  END AS cpc,
  
  CASE 
    WHEN conversions > 0 THEN ROUND(spend_credits::NUMERIC / conversions::NUMERIC, 2)
    ELSE 0
  END AS cpa,
  
  CASE 
    WHEN spend_credits > 0 AND conversion_value_cents > 0 
    THEN ROUND((conversion_value_cents::NUMERIC / 100) / spend_credits::NUMERIC, 2)
    ELSE 0
  END AS roas,
  
  CASE
    WHEN viewable_impressions > 0 THEN ROUND((viewable_impressions::NUMERIC / impressions::NUMERIC) * 100, 2)
    ELSE 0
  END AS viewability_rate,
  
  CASE
    WHEN conversions > 0 AND view_conversions > 0 
    THEN ROUND((view_conversions::NUMERIC / conversions::NUMERIC) * 100, 2)
    ELSE 0
  END AS view_through_rate

FROM daily_stats
WHERE impressions > 0 OR clicks > 0 OR conversions > 0 OR spend_credits > 0;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX analytics_campaign_daily_mv_pkey 
ON public.analytics_campaign_daily_mv (campaign_id, day);

-- Add indexes for common queries
CREATE INDEX idx_analytics_campaign_mv_day 
ON public.analytics_campaign_daily_mv (day DESC);

CREATE INDEX idx_analytics_campaign_mv_org 
ON public.analytics_campaign_daily_mv (org_id, day DESC);

-- Grant permissions
GRANT SELECT ON public.analytics_campaign_daily_mv TO authenticated, anon;

-- Refresh to apply fix
SELECT public.refresh_analytics();

-- Verify fix
SELECT 
  'AFTER FIX' AS status,
  day,
  impressions,
  clicks,
  spend_credits,
  avg_dwell_ms
FROM public.analytics_campaign_daily_mv
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC
LIMIT 5;



