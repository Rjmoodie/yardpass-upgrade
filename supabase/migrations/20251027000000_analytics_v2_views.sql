-- ===================================================================
-- ANALYTICS V2 VIEWS - Adapted for Liventix Schema
-- Migration: 20251027000000
-- ===================================================================

-- 1. Create utility schema and calendar spine
-- ===================================================================
CREATE SCHEMA IF NOT EXISTS util;

CREATE TABLE IF NOT EXISTS util.calendar_day(
  day DATE PRIMARY KEY
);

COMMENT ON TABLE util.calendar_day IS 'Calendar spine for filling gaps in time series analytics';

-- Seed last 365 days + next 30 days
INSERT INTO util.calendar_day(day)
SELECT d::DATE
FROM generate_series(
  (NOW() - INTERVAL '365 days')::DATE, 
  (NOW() + INTERVAL '30 days')::DATE, 
  INTERVAL '1 day'
) d
ON CONFLICT (day) DO NOTHING;

-- 2. Campaign Daily Analytics View
-- ===================================================================
-- NOTE: Creating in public schema so PostgREST API can access it
CREATE OR REPLACE VIEW public.analytics_campaign_daily AS
SELECT
  c.id AS campaign_id,
  cal.day,
  COALESCE(i.impressions, 0) AS impressions,
  COALESCE(cl.clicks, 0) AS clicks,
  COALESCE(cv.conversions, 0) AS conversions,
  COALESCE(cv.value_cents, 0) AS conversion_value_cents,
  COALESCE(sp.spend_credits, 0) AS spend_credits
FROM campaigns.campaigns c
CROSS JOIN util.calendar_day cal
-- Impressions
LEFT JOIN (
  SELECT 
    campaign_id, 
    created_at::DATE AS day, 
    COUNT(*) AS impressions
  FROM campaigns.ad_impressions
  GROUP BY 1, 2
) i ON i.campaign_id = c.id AND i.day = cal.day
-- Clicks
LEFT JOIN (
  SELECT 
    campaign_id, 
    created_at::DATE AS day, 
    COUNT(*) AS clicks
  FROM campaigns.ad_clicks
  GROUP BY 1, 2
) cl ON cl.campaign_id = c.id AND cl.day = cal.day
-- Conversions
LEFT JOIN (
  SELECT 
    COALESCE(clicks.campaign_id, imps.campaign_id) AS campaign_id,
    conv.occurred_at::DATE AS day,
    COUNT(*) AS conversions,
    SUM(COALESCE(conv.value_cents, 0)) AS value_cents
  FROM campaigns.ad_conversions conv
  LEFT JOIN campaigns.ad_clicks clicks ON clicks.id = conv.click_id
  LEFT JOIN campaigns.ad_impressions imps ON imps.id = conv.impression_id
  GROUP BY 1, 2
) cv ON cv.campaign_id = c.id AND cv.day = cal.day
-- Spend
LEFT JOIN (
  SELECT 
    campaign_id, 
    occurred_at::DATE AS day, 
    SUM(credits_charged) AS spend_credits
  FROM campaigns.ad_spend_ledger
  GROUP BY 1, 2
) sp ON sp.campaign_id = c.id AND sp.day = cal.day
-- Date range filter (only show relevant dates)
WHERE cal.day >= COALESCE(c.start_date::DATE, '2024-01-01')
  AND cal.day <= COALESCE(c.end_date::DATE, (NOW() + INTERVAL '30 days')::DATE);

COMMENT ON VIEW public.analytics_campaign_daily IS 
'V2: Daily campaign metrics with calendar spine for zero-filling. Includes impressions, clicks, conversions, conversion value, and spend.';

-- 3. Creative Daily Analytics View
-- ===================================================================
CREATE OR REPLACE VIEW public.analytics_creative_daily AS
SELECT
  cr.id AS creative_id,
  cr.campaign_id,
  cal.day,
  COALESCE(i.impressions, 0) AS impressions,
  COALESCE(cl.clicks, 0) AS clicks,
  COALESCE(cv.conversions, 0) AS conversions,
  COALESCE(sp.spend_credits, 0) AS spend_credits
FROM campaigns.ad_creatives cr
CROSS JOIN util.calendar_day cal
-- Impressions
LEFT JOIN (
  SELECT 
    creative_id, 
    created_at::DATE AS day, 
    COUNT(*) AS impressions
  FROM campaigns.ad_impressions
  WHERE creative_id IS NOT NULL
  GROUP BY 1, 2
) i ON i.creative_id = cr.id AND i.day = cal.day
-- Clicks
LEFT JOIN (
  SELECT 
    creative_id, 
    created_at::DATE AS day, 
    COUNT(*) AS clicks
  FROM campaigns.ad_clicks
  WHERE creative_id IS NOT NULL
  GROUP BY 1, 2
) cl ON cl.creative_id = cr.id AND cl.day = cal.day
-- Conversions
LEFT JOIN (
  SELECT 
    COALESCE(clicks.creative_id, imps.creative_id) AS creative_id,
    conv.occurred_at::DATE AS day,
    COUNT(*) AS conversions
  FROM campaigns.ad_conversions conv
  LEFT JOIN campaigns.ad_clicks clicks ON clicks.id = conv.click_id
  LEFT JOIN campaigns.ad_impressions imps ON imps.id = conv.impression_id
  WHERE COALESCE(clicks.creative_id, imps.creative_id) IS NOT NULL
  GROUP BY 1, 2
) cv ON cv.creative_id = cr.id AND cv.day = cal.day
-- Spend
LEFT JOIN (
  SELECT 
    creative_id, 
    occurred_at::DATE AS day, 
    SUM(credits_charged) AS spend_credits
  FROM campaigns.ad_spend_ledger
  WHERE creative_id IS NOT NULL
  GROUP BY 1, 2
) sp ON sp.creative_id = cr.id AND sp.day = cal.day
-- Date range filter
WHERE cal.day >= '2024-01-01'
  AND cal.day <= (NOW() + INTERVAL '7 days')::DATE;

COMMENT ON VIEW public.analytics_creative_daily IS 
'V2: Daily creative performance metrics. Tracks impressions, clicks, conversions, and spend per creative.';

-- 4. Viewability Quality Metrics View
-- ===================================================================
CREATE OR REPLACE VIEW public.analytics_viewability_campaign AS
SELECT
  campaign_id,
  COUNT(*) AS impressions,
  AVG(COALESCE(pct_visible, 0))::NUMERIC(6,2) AS avg_pct_visible,
  AVG(COALESCE(dwell_ms, 0))::NUMERIC(10,2) AS avg_dwell_ms,
  AVG(CASE WHEN viewable THEN 1 ELSE 0 END)::NUMERIC(5,4) AS viewability_rate
FROM campaigns.ad_impressions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY campaign_id;

COMMENT ON VIEW public.analytics_viewability_campaign IS 
'V2: Viewability quality metrics (30-day rolling window). Shows avg visibility %, dwell time, and viewability rate.';

-- 5. Attribution Model Breakdown View
-- ===================================================================
CREATE OR REPLACE VIEW public.analytics_attribution_campaign AS
WITH attr AS (
  SELECT
    COALESCE(ac.click_id IS NOT NULL, FALSE) AS is_click,
    CASE 
      WHEN ac.click_id IS NOT NULL THEN 'last_click_7d'
      WHEN ac.impression_id IS NOT NULL THEN 'view_through_1d'
      ELSE 'none' 
    END AS model,
    COALESCE(cl.campaign_id, im.campaign_id) AS campaign_id,
    ac.value_cents,
    ac.occurred_at::DATE AS day
  FROM campaigns.ad_conversions ac
  LEFT JOIN campaigns.ad_clicks cl ON cl.id = ac.click_id
  LEFT JOIN campaigns.ad_impressions im ON im.id = ac.impression_id
)
SELECT 
  campaign_id,
  day,
  SUM(CASE WHEN model = 'last_click_7d' THEN 1 ELSE 0 END) AS click_conversions,
  SUM(CASE WHEN model = 'view_through_1d' THEN 1 ELSE 0 END) AS vt_conversions,
  SUM(COALESCE(value_cents, 0)) AS total_value_cents
FROM attr
WHERE campaign_id IS NOT NULL
GROUP BY 1, 2;

COMMENT ON VIEW public.analytics_attribution_campaign IS 
'V2: Attribution model breakdown. Shows last-click vs view-through conversions by day.';

-- 6. Materialized View for Performance
-- ===================================================================
DROP MATERIALIZED VIEW IF EXISTS public.analytics_campaign_daily_mv CASCADE;

CREATE MATERIALIZED VIEW public.analytics_campaign_daily_mv AS
  SELECT * FROM public.analytics_campaign_daily;

-- UNIQUE index required for concurrent refresh (no blocking)
CREATE UNIQUE INDEX idx_acdmv_campaign_day_unique
  ON public.analytics_campaign_daily_mv(campaign_id, day);

-- Additional indexes for fast queries
CREATE INDEX idx_acdmv_day 
  ON public.analytics_campaign_daily_mv(day DESC);

COMMENT ON MATERIALIZED VIEW public.analytics_campaign_daily_mv IS 
'V2: Cached daily metrics for fast dashboard queries. Refresh every 5 minutes via cron.';

-- 7. Refresh Function
-- ===================================================================
CREATE OR REPLACE FUNCTION public.refresh_analytics() 
RETURNS VOID
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
BEGIN
  -- Refresh materialized view concurrently (doesn't block reads)
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.analytics_campaign_daily_mv;
  
  -- Log refresh time (optional, for monitoring)
  RAISE NOTICE 'Analytics refreshed at %', NOW();
END $$;

COMMENT ON FUNCTION public.refresh_analytics() IS 
'Refreshes analytics materialized views. Call via cron every 5 minutes.';

-- 8. Grants & RLS
-- ===================================================================
-- Allow authenticated and anon users to read analytics views
GRANT SELECT ON public.analytics_campaign_daily TO authenticated, anon;
GRANT SELECT ON public.analytics_creative_daily TO authenticated, anon;
GRANT SELECT ON public.analytics_viewability_campaign TO authenticated, anon;
GRANT SELECT ON public.analytics_attribution_campaign TO authenticated, anon;
GRANT SELECT ON public.analytics_campaign_daily_mv TO authenticated, anon;

-- Allow authenticated users to call refresh function (for manual refresh)
GRANT EXECUTE ON FUNCTION public.refresh_analytics() TO authenticated;

-- Grant usage on util schema
GRANT USAGE ON SCHEMA util TO authenticated, anon;
GRANT SELECT ON util.calendar_day TO authenticated, anon;

-- Initial refresh
SELECT public.refresh_analytics();

-- ===================================================================
-- Migration Complete
-- ===================================================================
-- Created:
--   - util.calendar_day (seeded with 395 days)
--   - public.analytics_campaign_daily (view)
--   - public.analytics_creative_daily (view)
--   - public.analytics_viewability_campaign (view)
--   - public.analytics_attribution_campaign (view)
--   - public.analytics_campaign_daily_mv (materialized view)
--   - public.refresh_analytics() (function)
--
-- Next steps:
--   1. Set up cron job to call refresh_analytics() every 5 minutes
--   2. Update frontend to query analytics_campaign_daily_mv
--   3. Drop old RPC functions (rpc_campaign_analytics_daily, etc.)
-- ===================================================================

