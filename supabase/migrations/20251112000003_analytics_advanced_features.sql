-- =====================================================================
-- AUDIENCE ANALYTICS - ADVANCED FEATURES & UTILITIES
-- Migration: 20251112000003_analytics_advanced_features.sql
-- =====================================================================
-- Adds identity promotion, leaky step analysis, backfill utilities
-- Implements actionable insights for organizers
-- =====================================================================

-- =====================================================================
-- 1. IDENTITY PROMOTION FUNCTION
-- =====================================================================
-- When a user authenticates, link their previous anonymous sessions

CREATE OR REPLACE FUNCTION analytics.promote_anonymous_identity(
  p_session_id TEXT,
  p_anon_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Use provided user_id or current authenticated user
  v_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user_id provided and no authenticated user';
  END IF;
  
  -- Promote session_id
  INSERT INTO analytics.identity_map (anon_key, user_id, first_seen, last_seen, promoted_at)
  VALUES (p_session_id, v_user_id, NOW(), NOW(), NOW())
  ON CONFLICT (anon_key) DO UPDATE
  SET user_id = v_user_id,
      last_seen = NOW(),
      promoted_at = COALESCE(analytics.identity_map.promoted_at, NOW()),
      promotion_count = analytics.identity_map.promotion_count + 1;
  
  -- Promote anon_id if provided
  IF p_anon_id IS NOT NULL THEN
    INSERT INTO analytics.identity_map (anon_key, user_id, first_seen, last_seen, promoted_at)
    VALUES (p_anon_id, v_user_id, NOW(), NOW(), NOW())
    ON CONFLICT (anon_key) DO UPDATE
    SET user_id = v_user_id,
        last_seen = NOW(),
        promoted_at = COALESCE(analytics.identity_map.promoted_at, NOW()),
        promotion_count = analytics.identity_map.promotion_count + 1;
  END IF;
  
  RAISE NOTICE 'Identity promoted: session=%, anon=%, user=%', p_session_id, p_anon_id, v_user_id;
END;
$$;

COMMENT ON FUNCTION analytics.promote_anonymous_identity IS 
  'Links anonymous session/anon_id to authenticated user for pre-login attribution.';

GRANT EXECUTE ON FUNCTION analytics.promote_anonymous_identity TO authenticated, service_role;

-- =====================================================================
-- 2. LEAKY STEP ANALYSIS
-- =====================================================================
-- Identifies where users drop off and why

CREATE OR REPLACE FUNCTION public.get_leaky_steps_analysis(
  p_org_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH 
  -- Users at each stage
  stage_users AS (
    SELECT 
      COALESCE(e.user_id::TEXT, e.session_id) AS user_key,
      MAX(CASE WHEN e.event_name IN ('page_view', 'event_impression') THEN 1 ELSE 0 END) AS reached_awareness,
      MAX(CASE WHEN e.event_name IN ('event_view', 'click_event_card') THEN 1 ELSE 0 END) AS reached_engagement,
      MAX(CASE WHEN e.event_name = 'ticket_cta_click' THEN 1 ELSE 0 END) AS reached_intent,
      MAX(CASE WHEN EXISTS(SELECT 1 FROM ticketing.orders o WHERE o.user_id = e.user_id) THEN 1 ELSE 0 END) AS reached_checkout,
      MAX(CASE WHEN EXISTS(SELECT 1 FROM ticketing.orders o WHERE o.user_id = e.user_id AND o.status IN ('paid','refunded')) THEN 1 ELSE 0 END) AS reached_purchase
    FROM analytics.events e
    WHERE e.ts BETWEEN p_from AND p_to
      AND NOT e.is_bot
      AND NOT e.is_internal
      AND (p_org_id IS NULL OR e.org_id = p_org_id)
    GROUP BY user_key
  ),
  
  -- Drop-off analysis
  drop_offs AS (
    SELECT
      'awareness→engagement' AS step,
      SUM(CASE WHEN reached_awareness = 1 AND reached_engagement = 0 THEN 1 ELSE 0 END) AS drop_users,
      'viewed_but_no_click' AS top_cause
    FROM stage_users
    
    UNION ALL
    
    SELECT
      'engagement→intent' AS step,
      SUM(CASE WHEN reached_engagement = 1 AND reached_intent = 0 THEN 1 ELSE 0 END) AS drop_users,
      'clicked_but_no_ticket_cta' AS top_cause
    FROM stage_users
    
    UNION ALL
    
    SELECT
      'intent→checkout' AS step,
      SUM(CASE WHEN reached_intent = 1 AND reached_checkout = 0 THEN 1 ELSE 0 END) AS drop_users,
      'ticket_cta_but_no_checkout' AS top_cause
    FROM stage_users
    
    UNION ALL
    
    SELECT
      'checkout→purchase' AS step,
      SUM(CASE WHEN reached_checkout = 1 AND reached_purchase = 0 THEN 1 ELSE 0 END) AS drop_users,
      'checkout_abandoned' AS top_cause
    FROM stage_users
  )
  
  SELECT jsonb_agg(
    jsonb_build_object(
      'step', step,
      'drop_users', drop_users,
      'top_causes', jsonb_build_array(top_cause)
    )
    ORDER BY drop_users DESC
  ) INTO v_result
  FROM drop_offs
  WHERE drop_users > 0;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_leaky_steps_analysis IS 
  'Identifies funnel steps with highest drop-off and potential causes.';

GRANT EXECUTE ON FUNCTION public.get_leaky_steps_analysis TO authenticated, service_role;

-- =====================================================================
-- 3. CREATIVE/LISTING DIAGNOSTICS
-- =====================================================================
-- Analyzes event card performance and provides optimization hints

CREATE OR REPLACE FUNCTION public.get_creative_diagnostics(
  p_org_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH event_performance AS (
    SELECT 
      ev.id,
      ev.title,
      ev.cover_image_url,
      COUNT(DISTINCT CASE WHEN e.event_name IN ('event_impression', 'post_view') THEN e.user_key END) AS impressions,
      COUNT(DISTINCT CASE WHEN e.event_name = 'ticket_cta_click' THEN e.user_key END) AS cta_clicks,
      COUNT(DISTINCT o.user_id) AS purchases,
      -- Check if event has media
      (SELECT COUNT(*) FROM posts.event_posts ep WHERE ep.event_id = ev.id AND ep.media_urls IS NOT NULL AND array_length(ep.media_urls, 1) > 0) AS media_count,
      -- Average position in feed (from props)
      AVG((e.props->>'position')::INTEGER) FILTER (WHERE e.props->>'position' IS NOT NULL) AS avg_position
    FROM events.events ev
    LEFT JOIN (
      SELECT 
        e.*,
        COALESCE(e.user_id::TEXT, e.session_id) AS user_key
      FROM analytics.events e
      WHERE e.ts BETWEEN p_from AND p_to
        AND NOT e.is_bot
        AND NOT e.is_internal
    ) e ON e.event_id = ev.id
    LEFT JOIN ticketing.orders o ON o.event_id = ev.id 
      AND o.status IN ('paid', 'refunded')
      AND o.created_at BETWEEN p_from AND p_to
    WHERE (p_org_id IS NULL OR (
      ev.owner_context_type = 'organization' 
      AND ev.owner_context_id = p_org_id
    ))
    GROUP BY ev.id, ev.title, ev.cover_image_url
    HAVING COUNT(DISTINCT CASE WHEN e.event_name IN ('event_impression', 'post_view') THEN e.user_key END) > 10
  ),
  
  -- Calculate benchmarks
  benchmarks AS (
    SELECT 
      AVG(CASE WHEN impressions > 0 THEN (cta_clicks::NUMERIC / impressions * 100) ELSE 0 END) AS avg_ctr,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY media_count) AS median_media_count
    FROM event_performance
  ),
  
  -- Generate insights
  insights AS (
    SELECT 
      ep.id,
      ep.title,
      ep.impressions,
      ep.cta_clicks,
      ROUND((ep.cta_clicks::NUMERIC / NULLIF(ep.impressions, 0) * 100), 1) AS ctr,
      ep.media_count,
      CASE 
        WHEN ep.cta_clicks::NUMERIC / NULLIF(ep.impressions, 0) * 100 < (SELECT avg_ctr FROM benchmarks) 
          AND ep.media_count < (SELECT median_media_count FROM benchmarks)
        THEN 'Add more photos/videos to improve CTR'
        WHEN ep.cta_clicks::NUMERIC / NULLIF(ep.impressions, 0) * 100 < (SELECT avg_ctr FROM benchmarks)
          AND ep.cover_image_url IS NULL
        THEN 'Add a cover image to improve visibility'
        WHEN ep.avg_position > 5 AND ep.cta_clicks < 10
        THEN 'Low visibility - consider boosting or improving title'
        ELSE 'Performing well'
      END AS recommendation
    FROM event_performance ep
    ORDER BY impressions DESC
    LIMIT 20
  )
  
  SELECT jsonb_agg(
    jsonb_build_object(
      'event_id', id,
      'title', title,
      'impressions', impressions,
      'ctr', ctr,
      'media_count', media_count,
      'recommendation', recommendation
    )
  ) INTO v_result
  FROM insights;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_creative_diagnostics IS 
  'Analyzes event card performance and provides actionable optimization recommendations.';

GRANT EXECUTE ON FUNCTION public.get_creative_diagnostics TO authenticated, service_role;

-- =====================================================================
-- 4. BACKFILL UTILITIES
-- =====================================================================
-- Migrate existing tracking data into analytics.events

CREATE OR REPLACE FUNCTION analytics.backfill_from_post_views()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  -- Backfill from post_views table
  INSERT INTO analytics.events (
    ts,
    event_name,
    user_id,
    session_id,
    anon_id,
    post_id,
    event_id,
    props,
    is_bot,
    created_at
  )
  SELECT 
    pv.created_at AS ts,
    'post_view' AS event_name,
    pv.user_id,
    COALESCE(pv.session_id, 'backfill-' || pv.id::TEXT) AS session_id,
    NULL AS anon_id,
    pv.post_id,
    pv.event_id,
    jsonb_build_object(
      'qualified', pv.qualified,
      'completed', pv.completed,
      'dwell_ms', pv.dwell_ms,
      'watch_percentage', pv.watch_percentage,
      'backfilled', TRUE
    ) AS props,
    FALSE AS is_bot,
    pv.created_at
  FROM posts.post_views pv
  WHERE NOT EXISTS (
    SELECT 1 FROM analytics.events e
    WHERE e.post_id = pv.post_id
      AND e.session_id = COALESCE(pv.session_id, 'backfill-' || pv.id::TEXT)
      AND e.ts = pv.created_at
  )
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  
  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION analytics.backfill_from_post_views IS 
  'Backfills analytics.events from posts.post_views table. Run once for historical data migration.';

GRANT EXECUTE ON FUNCTION analytics.backfill_from_post_views TO service_role;

CREATE OR REPLACE FUNCTION analytics.backfill_from_event_impressions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  -- Backfill from event_impressions table
  INSERT INTO analytics.events (
    ts,
    event_name,
    user_id,
    session_id,
    event_id,
    props,
    is_bot,
    created_at
  )
  SELECT 
    ei.created_at AS ts,
    'event_impression' AS event_name,
    ei.user_id,
    COALESCE(ei.session_id, 'backfill-' || ei.id::TEXT) AS session_id,
    ei.event_id,
    jsonb_build_object(
      'dwell_ms', ei.dwell_ms,
      'backfilled', TRUE
    ) AS props,
    FALSE AS is_bot,
    ei.created_at
  FROM events.event_impressions ei
  WHERE NOT EXISTS (
    SELECT 1 FROM analytics.events e
    WHERE e.event_id = ei.event_id
      AND e.session_id = COALESCE(ei.session_id, 'backfill-' || ei.id::TEXT)
      AND e.ts = ei.created_at
  )
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  
  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION analytics.backfill_from_event_impressions IS 
  'Backfills analytics.events from events.event_impressions table. Run once for historical data.';

GRANT EXECUTE ON FUNCTION analytics.backfill_from_event_impressions TO service_role;

CREATE OR REPLACE FUNCTION analytics.backfill_from_post_clicks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted INTEGER;
BEGIN
  -- Backfill from post_clicks table
  INSERT INTO analytics.events (
    ts,
    event_name,
    user_id,
    session_id,
    post_id,
    event_id,
    props,
    is_bot,
    created_at
  )
  SELECT 
    pc.created_at AS ts,
    'post_click' AS event_name,
    pc.user_id,
    COALESCE(pc.session_id, 'backfill-' || pc.id::TEXT) AS session_id,
    pc.post_id,
    pc.event_id,
    jsonb_build_object(
      'target', pc.target,
      'source', pc.source,
      'backfilled', TRUE
    ) AS props,
    FALSE AS is_bot,
    pc.created_at
  FROM posts.post_clicks pc
  WHERE NOT EXISTS (
    SELECT 1 FROM analytics.events e
    WHERE e.post_id = pc.post_id
      AND e.session_id = COALESCE(pc.session_id, 'backfill-' || pc.id::TEXT)
      AND e.ts = pc.created_at
  )
  ON CONFLICT DO NOTHING;
  
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  
  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION analytics.backfill_from_post_clicks IS 
  'Backfills analytics.events from posts.post_clicks table. Run once for historical data.';

GRANT EXECUTE ON FUNCTION analytics.backfill_from_post_clicks TO service_role;

-- Master backfill function
CREATE OR REPLACE FUNCTION analytics.backfill_all_sources()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_post_views INTEGER;
  v_impressions INTEGER;
  v_clicks INTEGER;
BEGIN
  RAISE NOTICE 'Starting analytics backfill...';
  
  v_post_views := analytics.backfill_from_post_views();
  RAISE NOTICE 'Backfilled % post views', v_post_views;
  
  v_impressions := analytics.backfill_from_event_impressions();
  RAISE NOTICE 'Backfilled % event impressions', v_impressions;
  
  v_clicks := analytics.backfill_from_post_clicks();
  RAISE NOTICE 'Backfilled % post clicks', v_clicks;
  
  RETURN jsonb_build_object(
    'post_views', v_post_views,
    'event_impressions', v_impressions,
    'post_clicks', v_clicks,
    'total', v_post_views + v_impressions + v_clicks,
    'completed_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION analytics.backfill_all_sources IS 
  'Backfills analytics.events from all legacy tracking tables. Run once for migration.';

GRANT EXECUTE ON FUNCTION analytics.backfill_all_sources TO service_role;

-- =====================================================================
-- 5. LTV (LIFETIME VALUE) CALCULATION
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_user_ltv(
  p_user_id UUID,
  p_org_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH user_orders AS (
    SELECT 
      o.id,
      o.total_cents,
      o.created_at,
      o.event_id,
      o.status,
      COALESCE(rl.refund_amount_cents, 0) AS refunded_cents
    FROM ticketing.orders o
    LEFT JOIN ticketing.refund_log rl ON rl.order_id = o.id
    WHERE o.user_id = p_user_id
      AND o.status IN ('paid', 'refunded')
      AND (p_org_id IS NULL OR EXISTS (
        SELECT 1 FROM events.events ev
        WHERE ev.id = o.event_id
          AND ev.owner_context_type = 'organization'
          AND ev.owner_context_id = p_org_id
      ))
  )
  SELECT jsonb_build_object(
    'user_id', p_user_id,
    'total_orders', COUNT(*),
    'gross_revenue_cents', COALESCE(SUM(total_cents), 0),
    'net_revenue_cents', COALESCE(SUM(total_cents - refunded_cents), 0),
    'avg_order_value_cents', ROUND(AVG(total_cents)),
    'first_purchase_at', MIN(created_at),
    'last_purchase_at', MAX(created_at),
    'repeat_customer', COUNT(*) > 1
  ) INTO v_result
  FROM user_orders;
  
  RETURN COALESCE(v_result, jsonb_build_object('user_id', p_user_id, 'total_orders', 0));
END;
$$;

COMMENT ON FUNCTION public.get_user_ltv IS 
  'Calculates lifetime value metrics for a specific user.';

GRANT EXECUTE ON FUNCTION public.get_user_ltv TO authenticated, service_role;

-- =====================================================================
-- 6. COHORT RETENTION ANALYSIS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_cohort_retention(
  p_org_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_cohort_period TEXT DEFAULT 'week'  -- 'day' | 'week' | 'month'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_interval INTERVAL;
BEGIN
  -- Determine interval
  v_interval := CASE p_cohort_period
    WHEN 'day' THEN '1 day'::INTERVAL
    WHEN 'week' THEN '1 week'::INTERVAL
    WHEN 'month' THEN '1 month'::INTERVAL
    ELSE '1 week'::INTERVAL
  END;
  
  WITH first_purchases AS (
    SELECT 
      o.user_id,
      DATE_TRUNC(p_cohort_period, MIN(o.created_at)) AS cohort_period,
      MIN(o.created_at) AS first_purchase_at
    FROM ticketing.orders o
    WHERE o.status IN ('paid', 'refunded')
      AND o.created_at BETWEEN p_from AND p_to
      AND (p_org_id IS NULL OR EXISTS (
        SELECT 1 FROM events.events ev
        WHERE ev.id = o.event_id
          AND ev.owner_context_type = 'organization'
          AND ev.owner_context_id = p_org_id
      ))
    GROUP BY o.user_id
  ),
  
  retention_data AS (
    SELECT 
      fp.cohort_period,
      COUNT(DISTINCT fp.user_id) AS cohort_size,
      COUNT(DISTINCT CASE 
        WHEN EXISTS (
          SELECT 1 FROM ticketing.orders o2
          WHERE o2.user_id = fp.user_id
            AND o2.created_at > fp.first_purchase_at + v_interval
            AND o2.created_at <= fp.first_purchase_at + (v_interval * 2)
            AND o2.status IN ('paid', 'refunded')
        ) THEN fp.user_id 
      END) AS retained_period_1,
      COUNT(DISTINCT CASE 
        WHEN EXISTS (
          SELECT 1 FROM ticketing.orders o2
          WHERE o2.user_id = fp.user_id
            AND o2.created_at > fp.first_purchase_at + (v_interval * 2)
            AND o2.created_at <= fp.first_purchase_at + (v_interval * 3)
            AND o2.status IN ('paid', 'refunded')
        ) THEN fp.user_id 
      END) AS retained_period_2,
      COUNT(DISTINCT CASE 
        WHEN EXISTS (
          SELECT 1 FROM ticketing.orders o2
          WHERE o2.user_id = fp.user_id
            AND o2.created_at > fp.first_purchase_at + (v_interval * 3)
            AND o2.status IN ('paid', 'refunded')
        ) THEN fp.user_id 
      END) AS retained_period_3
    FROM first_purchases fp
    GROUP BY fp.cohort_period
    ORDER BY fp.cohort_period DESC
  )
  
  SELECT jsonb_agg(
    jsonb_build_object(
      'cohort', cohort_period,
      'cohort_size', cohort_size,
      'retention_period_1', ROUND((retained_period_1::NUMERIC / NULLIF(cohort_size, 0) * 100), 1),
      'retention_period_2', ROUND((retained_period_2::NUMERIC / NULLIF(cohort_size, 0) * 100), 1),
      'retention_period_3', ROUND((retained_period_3::NUMERIC / NULLIF(cohort_size, 0) * 100), 1)
    )
  ) INTO v_result
  FROM retention_data;
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.get_cohort_retention IS 
  'Calculates cohort retention rates for repeat purchases.';

GRANT EXECUTE ON FUNCTION public.get_cohort_retention TO authenticated, service_role;

-- =====================================================================
-- 7. PREDICTIVE ANALYTICS - SELLOUT FORECAST
-- =====================================================================

CREATE OR REPLACE FUNCTION public.forecast_sellout_date(
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_capacity INTEGER;
  v_sold INTEGER;
  v_remaining INTEGER;
  v_daily_rate NUMERIC;
  v_days_to_sellout INTEGER;
  v_forecast_date TIMESTAMPTZ;
BEGIN
  -- Get event capacity
  SELECT 
    COALESCE(SUM(tt.quantity), 0),
    COALESCE(SUM(tt.quantity_sold), 0)
  INTO v_capacity, v_sold
  FROM ticketing.ticket_tiers tt
  WHERE tt.event_id = p_event_id;
  
  v_remaining := v_capacity - v_sold;
  
  -- Calculate daily sales rate (last 7 days)
  SELECT 
    COUNT(*)::NUMERIC / 7.0
  INTO v_daily_rate
  FROM ticketing.tickets t
  WHERE t.event_id = p_event_id
    AND t.created_at >= NOW() - INTERVAL '7 days';
  
  -- Forecast sellout
  IF v_daily_rate > 0 AND v_remaining > 0 THEN
    v_days_to_sellout := CEIL(v_remaining / v_daily_rate);
    v_forecast_date := NOW() + (v_days_to_sellout || ' days')::INTERVAL;
  ELSE
    v_days_to_sellout := NULL;
    v_forecast_date := NULL;
  END IF;
  
  v_result := jsonb_build_object(
    'event_id', p_event_id,
    'capacity', v_capacity,
    'sold', v_sold,
    'remaining', v_remaining,
    'daily_sales_rate', ROUND(v_daily_rate, 1),
    'days_to_sellout', v_days_to_sellout,
    'forecast_sellout_date', v_forecast_date,
    'confidence', CASE 
      WHEN v_daily_rate > 5 THEN 'high'
      WHEN v_daily_rate > 1 THEN 'medium'
      ELSE 'low'
    END
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.forecast_sellout_date IS 
  'Predicts when an event will sell out based on recent sales velocity.';

GRANT EXECUTE ON FUNCTION public.forecast_sellout_date TO authenticated, service_role;

-- =====================================================================
-- 8. ANOMALY DETECTION
-- =====================================================================

CREATE OR REPLACE FUNCTION public.detect_funnel_anomalies(
  p_org_id UUID,
  p_current_from TIMESTAMPTZ,
  p_current_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current JSONB;
  v_previous JSONB;
  v_anomalies JSONB;
  v_threshold NUMERIC := 30.0;  -- 30% change threshold
BEGIN
  -- Get current period data
  v_current := public.get_audience_funnel_internal(
    p_org_id,
    p_current_from,
    p_current_to,
    NULL,
    'none',
    'last_touch',
    TRUE
  );
  
  -- Get previous period data (same duration)
  v_previous := public.get_audience_funnel_internal(
    p_org_id,
    p_current_from - (p_current_to - p_current_from),
    p_current_from,
    NULL,
    'none',
    'last_touch',
    TRUE
  );
  
  -- Compare and identify anomalies
  WITH comparisons AS (
    SELECT 
      jsonb_array_elements(v_current->'funnel_steps')->>'stage' AS stage,
      (jsonb_array_elements(v_current->'funnel_steps')->>'users')::INTEGER AS current_users,
      (jsonb_array_elements(v_previous->'funnel_steps')->>'users')::INTEGER AS previous_users
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'stage', stage,
      'current_users', current_users,
      'previous_users', previous_users,
      'change_pct', ROUND(
        CASE WHEN previous_users > 0 
          THEN ((current_users - previous_users)::NUMERIC / previous_users * 100)
          ELSE 0 
        END, 
        1
      ),
      'severity', CASE 
        WHEN ABS((current_users - previous_users)::NUMERIC / NULLIF(previous_users, 1) * 100) > v_threshold THEN 'high'
        WHEN ABS((current_users - previous_users)::NUMERIC / NULLIF(previous_users, 1) * 100) > (v_threshold / 2) THEN 'medium'
        ELSE 'low'
      END
    )
  ) FILTER (WHERE ABS((current_users - previous_users)::NUMERIC / NULLIF(previous_users, 1) * 100) > (v_threshold / 2))
  INTO v_anomalies
  FROM comparisons;
  
  RETURN jsonb_build_object(
    'anomalies', COALESCE(v_anomalies, '[]'::jsonb),
    'threshold_pct', v_threshold,
    'current_period', jsonb_build_object('from', p_current_from, 'to', p_current_to),
    'comparison_period', jsonb_build_object(
      'from', p_current_from - (p_current_to - p_current_from),
      'to', p_current_from
    )
  );
END;
$$;

COMMENT ON FUNCTION public.detect_funnel_anomalies IS 
  'Detects significant changes in funnel metrics vs previous period. Used for alerts.';

GRANT EXECUTE ON FUNCTION public.detect_funnel_anomalies TO authenticated, service_role;

-- =====================================================================
-- MIGRATION COMPLETE - PHASE 3: ADVANCED FEATURES
-- =====================================================================

-- Summary:
-- ✅ Identity promotion for pre-login attribution
-- ✅ Leaky step analysis with drop-off causes
-- ✅ Creative diagnostics with actionable recommendations
-- ✅ Backfill utilities for historical data migration
-- ✅ LTV calculation per user
-- ✅ Cohort retention analysis
-- ✅ Sellout forecasting
-- ✅ Anomaly detection for alerts
--
-- Next: Phase 4 - Frontend integration and feature flags

