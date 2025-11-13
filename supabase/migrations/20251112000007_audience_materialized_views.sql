-- =====================================================================
-- AUDIENCE INTELLIGENCE - MATERIALIZED VIEWS
-- Migration: 20251112000007_audience_materialized_views.sql
-- =====================================================================
-- Pre-aggregated views for sub-200ms queries on audience data
-- =====================================================================

-- =====================================================================
-- 1. AUDIENCE BY CHANNEL (Daily Aggregates)
-- =====================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_audience_by_channel AS
SELECT
  DATE(ts) AS day,
  org_id,
  COALESCE(utm_source, 'direct') AS source,
  COALESCE(utm_medium, 'none') AS medium,
  COALESCE(utm_campaign, 'none') AS campaign,
  
  -- Visitor metrics
  COUNT(DISTINCT COALESCE(user_id::TEXT, session_id)) AS visitors,
  COUNT(DISTINCT session_id) AS sessions,
  
  -- Engagement metrics
  COUNT(*) FILTER (WHERE event_name IN ('ticket_cta_click', 'get_tickets_click')) AS ctas,
  COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'checkout_started') AS checkout_starters,
  
  -- Device breakdown
  COUNT(*) FILTER (WHERE device_type = 'mobile') AS mobile_sessions,
  COUNT(*) FILTER (WHERE device_type = 'desktop') AS desktop_sessions,
  COUNT(*) FILTER (WHERE device_type = 'tablet') AS tablet_sessions
FROM analytics.events
WHERE NOT is_bot
  AND NOT is_internal
  AND ts >= NOW() - INTERVAL '90 days'
GROUP BY day, org_id, source, medium, campaign;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX ON analytics.mv_audience_by_channel(day, org_id, source, medium, campaign);

-- Regular indexes
CREATE INDEX ON analytics.mv_audience_by_channel(org_id, day DESC);
CREATE INDEX ON analytics.mv_audience_by_channel(source, day DESC);
CREATE INDEX ON analytics.mv_audience_by_channel(visitors DESC);

COMMENT ON MATERIALIZED VIEW analytics.mv_audience_by_channel IS 
  'Daily aggregates by acquisition channel. Refreshed nightly for 90-day window.';

GRANT SELECT ON analytics.mv_audience_by_channel TO authenticated;

-- =====================================================================
-- 2. DEVICE & NETWORK PERFORMANCE (Daily Aggregates)
-- =====================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_device_network AS
SELECT
  DATE(ts) AS day,
  org_id,
  COALESCE(device_type, 'unknown') AS device,
  COALESCE(device_os, 'unknown') AS os,
  COALESCE(network_type, 'unknown') AS network,
  
  -- Session metrics
  COUNT(DISTINCT session_id) AS sessions,
  COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS auth_users,
  
  -- Performance metrics
  ROUND(AVG(page_load_ms)) AS avg_page_load_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY page_load_ms) AS median_page_load_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY page_load_ms) AS p95_page_load_ms,
  
  -- Engagement
  COUNT(*) FILTER (WHERE event_name = 'ticket_cta_click') AS cta_clicks
FROM analytics.events
WHERE NOT is_bot
  AND NOT is_internal
  AND ts >= NOW() - INTERVAL '90 days'
GROUP BY DATE(ts), org_id, COALESCE(device_type, 'unknown'), COALESCE(device_os, 'unknown'), COALESCE(network_type, 'unknown');

CREATE UNIQUE INDEX ON analytics.mv_device_network(day, org_id, device, os, network);
CREATE INDEX ON analytics.mv_device_network(org_id, day DESC);
CREATE INDEX ON analytics.mv_device_network(device, network, day DESC);

COMMENT ON MATERIALIZED VIEW analytics.mv_device_network IS 
  'Daily device and network performance metrics. Refreshed nightly.';

GRANT SELECT ON analytics.mv_device_network TO authenticated;

-- =====================================================================
-- 3. COHORT RETENTION (Weekly Cohorts)
-- =====================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS analytics.mv_cohort_retention AS
WITH first_purchases AS (
  SELECT
    o.user_id,
    DATE_TRUNC('week', MIN(o.created_at))::DATE AS cohort_week,
    (SELECT ev.owner_context_id 
     FROM events.events ev 
     WHERE ev.id = o.event_id 
       AND ev.owner_context_type = 'organization'
     LIMIT 1) AS org_id
  FROM ticketing.orders o
  WHERE o.status IN ('paid', 'refunded')
    AND o.created_at >= NOW() - INTERVAL '26 weeks'  -- 6 months
  GROUP BY o.user_id, o.event_id
),
repeat_purchases AS (
  SELECT
    fp.cohort_week,
    fp.org_id,
    FLOOR(EXTRACT(EPOCH FROM (o.created_at - fp.cohort_week::TIMESTAMPTZ)) / 604800)::INTEGER AS week_offset,
    COUNT(DISTINCT o.user_id) AS repeat_buyers
  FROM first_purchases fp
  JOIN ticketing.orders o ON o.user_id = fp.user_id
  WHERE o.status IN ('paid', 'refunded')
    AND o.created_at >= fp.cohort_week::TIMESTAMPTZ
    AND EXISTS (
      SELECT 1 FROM events.events ev
      WHERE ev.id = o.event_id
        AND ev.owner_context_type = 'organization'
        AND ev.owner_context_id = fp.org_id
    )
  GROUP BY fp.cohort_week, fp.org_id, week_offset
)
SELECT
  cohort_week,
  org_id,
  week_offset,
  repeat_buyers,
  (SELECT COUNT(DISTINCT user_id) 
   FROM first_purchases 
   WHERE first_purchases.cohort_week = rp.cohort_week 
     AND first_purchases.org_id = rp.org_id
  ) AS cohort_size,
  ROUND(
    100.0 * repeat_buyers::NUMERIC / 
    NULLIF((SELECT COUNT(DISTINCT user_id) 
            FROM first_purchases 
            WHERE first_purchases.cohort_week = rp.cohort_week 
              AND first_purchases.org_id = rp.org_id), 0),
    1
  ) AS retention_rate
FROM repeat_purchases rp
WHERE week_offset <= 12;  -- 12 weeks of data

CREATE UNIQUE INDEX ON analytics.mv_cohort_retention(cohort_week, org_id, week_offset);
CREATE INDEX ON analytics.mv_cohort_retention(org_id, cohort_week DESC);

COMMENT ON MATERIALIZED VIEW analytics.mv_cohort_retention IS 
  'Weekly cohort retention rates. Refreshed nightly.';

GRANT SELECT ON analytics.mv_cohort_retention TO authenticated;

-- =====================================================================
-- 4. REFRESH ALL AUDIENCE MVS
-- =====================================================================

CREATE OR REPLACE FUNCTION analytics.refresh_audience_views()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_audience_by_channel;
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_device_network;
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.mv_cohort_retention;
  
  RAISE NOTICE 'Audience materialized views refreshed at %', NOW();
END;
$$;

COMMENT ON FUNCTION analytics.refresh_audience_views IS 
  'Refreshes all audience materialized views. Run nightly via pg_cron.';

GRANT EXECUTE ON FUNCTION analytics.refresh_audience_views TO service_role;

-- =====================================================================
-- 5. HIGH-INTENT VISITORS (Real-time)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_high_intent_visitors(
  p_org_id UUID,
  p_hours INTEGER DEFAULT 24,
  p_min_score INTEGER DEFAULT 7
)
RETURNS TABLE(
  user_id UUID,
  display_name TEXT,
  propensity_score INTEGER,
  recent_events TEXT[],
  last_activity TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH recent_activity AS (
    SELECT
      e.user_id,
      analytics.calculate_propensity_score(e.user_id, p_org_id) AS score,
      ARRAY_AGG(DISTINCT e.event_name ORDER BY e.event_name) AS events,
      MAX(e.ts) AS last_seen
    FROM analytics.events e
    WHERE e.org_id = p_org_id
      AND e.ts >= NOW() - (p_hours || ' hours')::INTERVAL
      AND e.user_id IS NOT NULL
      AND NOT e.is_bot
      AND NOT e.is_internal
      AND e.event_name IN ('page_view', 'event_view', 'ticket_cta_click', 'checkout_started')
    GROUP BY e.user_id
    HAVING analytics.calculate_propensity_score(e.user_id, p_org_id) >= p_min_score
  )
  SELECT
    ra.user_id,
    up.display_name,
    ra.score,
    ra.events,
    ra.last_seen
  FROM recent_activity ra
  LEFT JOIN users.user_profiles up ON up.user_id = ra.user_id
  ORDER BY ra.score DESC, ra.last_seen DESC
  LIMIT 100;
END;
$$;

COMMENT ON FUNCTION public.get_high_intent_visitors IS 
  'Returns visitors with high propensity scores in the last N hours for immediate action.';

GRANT EXECUTE ON FUNCTION public.get_high_intent_visitors TO authenticated, service_role;

-- =====================================================================
-- MIGRATION COMPLETE - AUDIENCE MATERIALIZED VIEWS
-- =====================================================================

-- Summary:
-- ✅ mv_audience_by_channel - Daily channel aggregates
-- ✅ mv_device_network - Device/network performance
-- ✅ mv_cohort_retention - Weekly retention curves
-- ✅ refresh_audience_views() - Nightly refresh function
-- ✅ get_high_intent_visitors() - Real-time hot leads
--
-- Next: Create React components and hooks

