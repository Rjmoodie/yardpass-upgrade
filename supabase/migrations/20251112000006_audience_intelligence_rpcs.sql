-- =====================================================================
-- AUDIENCE INTELLIGENCE - RPC FUNCTIONS
-- Migration: 20251112000006_audience_intelligence_rpcs.sql
-- =====================================================================
-- Core analytics functions for audience intelligence features
-- =====================================================================

-- =====================================================================
-- 1. AUDIENCE OVERVIEW
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_audience_overview(
  p_org_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, analytics, ticketing
AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH visitors AS (
    SELECT COUNT(DISTINCT COALESCE(user_id::TEXT, session_id)) AS uu
    FROM analytics.events
    WHERE ts BETWEEN p_from AND p_to
      AND org_id = p_org_id
      AND NOT is_bot
      AND NOT is_internal
  ),
  sessions AS (
    SELECT COUNT(DISTINCT session_id) AS sessions
    FROM analytics.events
    WHERE ts BETWEEN p_from AND p_to
      AND org_id = p_org_id
      AND NOT is_bot
      AND NOT is_internal
  ),
  new_vs_returning AS (
    SELECT 
      COUNT(DISTINCT user_id) FILTER (WHERE first_order_at BETWEEN p_from AND p_to) AS new_buyers,
      COUNT(DISTINCT user_id) FILTER (WHERE first_order_at < p_from) AS returning_buyers
    FROM analytics.audience_customers
    WHERE org_id = p_org_id
      AND last_order_at BETWEEN p_from AND p_to
  ),
  orders_data AS (
    SELECT
      COUNT(*) FILTER (WHERE status IN ('pending', 'paid', 'refunded')) AS checkouts,
      COUNT(*) FILTER (WHERE status IN ('paid', 'refunded')) AS purchases,
      COALESCE(SUM(CASE WHEN status IN ('paid', 'refunded') THEN total_cents END), 0) AS gross_cents,
      COALESCE(SUM(CASE WHEN status IN ('paid', 'refunded') THEN total_cents END), 0) - 
        COALESCE((
          SELECT SUM(refund_amount_cents)
          FROM ticketing.refund_log rl
          JOIN ticketing.orders o2 ON o2.id = rl.order_id
          WHERE o2.created_at BETWEEN p_from AND p_to
        ), 0) AS net_cents,
      COUNT(DISTINCT user_id) FILTER (WHERE status IN ('paid', 'refunded')) AS unique_buyers,
      ROUND(AVG(CASE WHEN status IN ('paid', 'refunded') THEN total_cents END)) AS aov_cents
    FROM ticketing.orders o
    WHERE o.created_at BETWEEN p_from AND p_to
      AND EXISTS (
        SELECT 1 FROM events.events ev
        WHERE ev.id = o.event_id
          AND ev.owner_context_type = 'organization'
          AND ev.owner_context_id = p_org_id
      )
  )
  SELECT jsonb_build_object(
    'visitors', (SELECT uu FROM visitors),
    'sessions', (SELECT sessions FROM sessions),
    'new_buyers', COALESCE((SELECT new_buyers FROM new_vs_returning), 0),
    'returning_buyers', COALESCE((SELECT returning_buyers FROM new_vs_returning), 0),
    'checkout_start_rate', ROUND(
      100.0 * (SELECT checkouts FROM orders_data)::NUMERIC / 
      NULLIF((SELECT uu FROM visitors), 0), 
      1
    ),
    'purchase_rate', ROUND(
      100.0 * (SELECT purchases FROM orders_data)::NUMERIC / 
      NULLIF((SELECT uu FROM visitors), 0), 
      1
    ),
    'unique_buyers', COALESCE((SELECT unique_buyers FROM orders_data), 0),
    'gross_revenue_cents', COALESCE((SELECT gross_cents FROM orders_data), 0),
    'net_revenue_cents', COALESCE((SELECT net_cents FROM orders_data), 0),
    'aov_cents', COALESCE((SELECT aov_cents FROM orders_data), 0),
    'mobile_conversion_rate', (
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE device_type = 'mobile' AND status IN ('paid', 'refunded'))::NUMERIC /
        NULLIF(COUNT(DISTINCT session_id) FILTER (WHERE device_type = 'mobile'), 0),
        1
      )
      FROM analytics.events e
      LEFT JOIN ticketing.orders o ON o.user_id = e.user_id
      WHERE e.ts BETWEEN p_from AND p_to
        AND e.org_id = p_org_id
        AND NOT e.is_bot
    ),
    'desktop_conversion_rate', (
      SELECT ROUND(
        100.0 * COUNT(*) FILTER (WHERE device_type = 'desktop' AND status IN ('paid', 'refunded'))::NUMERIC /
        NULLIF(COUNT(DISTINCT session_id) FILTER (WHERE device_type = 'desktop'), 0),
        1
      )
      FROM analytics.events e
      LEFT JOIN ticketing.orders o ON o.user_id = e.user_id
      WHERE e.ts BETWEEN p_from AND p_to
        AND e.org_id = p_org_id
        AND NOT e.is_bot
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_audience_overview IS 
  'Returns comprehensive audience overview metrics: visitors, sessions, conversion rates, new vs returning.';

GRANT EXECUTE ON FUNCTION public.get_audience_overview TO authenticated, service_role;

-- =====================================================================
-- 2. ACQUISITION QUALITY (Source/Medium/Campaign Performance)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_audience_acquisition(
  p_org_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE(
  source TEXT,
  medium TEXT,
  campaign TEXT,
  visitors BIGINT,
  ctas BIGINT,
  checkouts BIGINT,
  purchases BIGINT,
  revenue_cents BIGINT,
  refund_rate NUMERIC,
  aov_cents NUMERIC,
  ltv_cents NUMERIC,
  ctr NUMERIC,
  purchase_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH base_visitors AS (
    SELECT
      COALESCE(utm_source, 'direct') AS source,
      COALESCE(utm_medium, 'none') AS medium,
      COALESCE(utm_campaign, 'none') AS campaign,
      COALESCE(user_id::TEXT, session_id) AS user_key
    FROM analytics.events
    WHERE org_id = p_org_id 
      AND ts BETWEEN p_from AND p_to
      AND event_name = 'page_view'
      AND NOT is_bot
      AND NOT is_internal
  ),
  cta_events AS (
    SELECT
      COALESCE(utm_source, 'direct') AS source,
      COALESCE(utm_medium, 'none') AS medium,
      COALESCE(utm_campaign, 'none') AS campaign,
      COUNT(*) AS ctas
    FROM analytics.events
    WHERE org_id = p_org_id
      AND ts BETWEEN p_from AND p_to
      AND event_name IN ('ticket_cta_click', 'get_tickets_click')
      AND NOT is_bot
    GROUP BY 1, 2, 3
  ),
  checkout_events AS (
    SELECT
      COALESCE(e.utm_source, 'direct') AS source,
      COALESCE(e.utm_medium, 'none') AS medium,
      COALESCE(e.utm_campaign, 'none') AS campaign,
      COUNT(DISTINCT o.id) AS checkouts
    FROM ticketing.orders o
    LEFT JOIN analytics.events e ON e.user_id = o.user_id 
      AND e.event_name = 'page_view'
      AND e.ts <= o.created_at
      AND e.ts >= o.created_at - INTERVAL '7 days'
    WHERE o.created_at BETWEEN p_from AND p_to
      AND EXISTS (
        SELECT 1 FROM events.events ev
        WHERE ev.id = o.event_id
          AND ev.owner_context_type = 'organization'
          AND ev.owner_context_id = p_org_id
      )
    GROUP BY 1, 2, 3
  ),
  purchase_data AS (
    SELECT
      COALESCE(e.utm_source, 'direct') AS source,
      COALESCE(e.utm_medium, 'none') AS medium,
      COALESCE(e.utm_campaign, 'none') AS campaign,
      COUNT(*) AS purchases,
      SUM(o.total_cents) AS revenue_cents,
      ROUND(AVG(o.total_cents)) AS aov_cents,
      COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM ticketing.refund_log rl WHERE rl.order_id = o.id
      ))::NUMERIC / NULLIF(COUNT(*), 0) * 100 AS refund_rate
    FROM ticketing.orders o
    LEFT JOIN analytics.events e ON e.user_id = o.user_id
      AND e.event_name = 'page_view'
      AND e.ts <= o.created_at
      AND e.ts >= o.created_at - INTERVAL '7 days'
    WHERE o.status IN ('paid', 'refunded')
      AND o.created_at BETWEEN p_from AND p_to
      AND EXISTS (
        SELECT 1 FROM events.events ev
        WHERE ev.id = o.event_id
          AND ev.owner_context_type = 'organization'
          AND ev.owner_context_id = p_org_id
      )
    GROUP BY 1, 2, 3
  ),
  ltv_data AS (
    SELECT
      ac.first_touch_source AS source,
      ROUND(AVG(ac.net_cents)) AS avg_ltv_cents
    FROM analytics.audience_customers ac
    WHERE ac.org_id = p_org_id
      AND ac.first_order_at >= p_from - INTERVAL '90 days'  -- Recent cohorts only
    GROUP BY 1
  )
  SELECT
    bv.source,
    bv.medium,
    bv.campaign,
    COUNT(DISTINCT bv.user_key) AS visitors,
    COALESCE(cta.ctas, 0) AS ctas,
    COALESCE(co.checkouts, 0) AS checkouts,
    COALESCE(pd.purchases, 0) AS purchases,
    COALESCE(pd.revenue_cents, 0) AS revenue_cents,
    COALESCE(pd.refund_rate, 0) AS refund_rate,
    COALESCE(pd.aov_cents, 0) AS aov_cents,
    COALESCE(ltv.avg_ltv_cents, 0) AS ltv_cents,
    ROUND(
      100.0 * COALESCE(cta.ctas, 0)::NUMERIC / NULLIF(COUNT(DISTINCT bv.user_key), 0),
      1
    ) AS ctr,
    ROUND(
      100.0 * COALESCE(pd.purchases, 0)::NUMERIC / NULLIF(COUNT(DISTINCT bv.user_key), 0),
      1
    ) AS purchase_rate
  FROM base_visitors bv
  LEFT JOIN cta_events cta USING (source, medium, campaign)
  LEFT JOIN checkout_events co USING (source, medium, campaign)
  LEFT JOIN purchase_data pd USING (source, medium, campaign)
  LEFT JOIN ltv_data ltv ON ltv.source = bv.source
  GROUP BY bv.source, bv.medium, bv.campaign, cta.ctas, co.checkouts, 
           pd.purchases, pd.revenue_cents, pd.refund_rate, pd.aov_cents, ltv.avg_ltv_cents
  ORDER BY revenue_cents DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_audience_acquisition IS 
  'Returns acquisition quality metrics by source/medium/campaign with conversion, revenue, and LTV.';

GRANT EXECUTE ON FUNCTION public.get_audience_acquisition TO authenticated, service_role;

-- =====================================================================
-- 3. DEVICE & NETWORK PERFORMANCE
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_audience_device_network(
  p_org_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS TABLE(
  device TEXT,
  network TEXT,
  sessions BIGINT,
  purchases BIGINT,
  conversion_rate NUMERIC,
  avg_page_load_ms INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH sess AS (
    SELECT 
      COALESCE(device_type, 'unknown') AS device,
      COALESCE(network_type, 'unknown') AS network,
      COUNT(DISTINCT session_id) AS sessions,
      ROUND(AVG(page_load_ms)) AS avg_load_ms
    FROM analytics.events
    WHERE org_id = p_org_id 
      AND ts BETWEEN p_from AND p_to
      AND NOT is_bot
      AND NOT is_internal
    GROUP BY 1, 2
  ),
  conv AS (
    SELECT 
      COALESCE(e.device_type, 'unknown') AS device,
      COALESCE(e.network_type, 'unknown') AS network,
      COUNT(DISTINCT o.id) AS purchases
    FROM ticketing.orders o
    JOIN analytics.events e ON e.user_id = o.user_id
      AND e.ts <= o.created_at
      AND e.ts >= o.created_at - INTERVAL '1 day'
    WHERE o.status IN ('paid', 'refunded')
      AND o.created_at BETWEEN p_from AND p_to
      AND EXISTS (
        SELECT 1 FROM events.events ev
        WHERE ev.id = o.event_id
          AND ev.owner_context_type = 'organization'
          AND ev.owner_context_id = p_org_id
      )
    GROUP BY 1, 2
  )
  SELECT 
    s.device,
    s.network,
    s.sessions,
    COALESCE(c.purchases, 0) AS purchases,
    ROUND(100.0 * COALESCE(c.purchases, 0)::NUMERIC / NULLIF(s.sessions, 0), 1) AS conversion_rate,
    s.avg_load_ms::INTEGER AS avg_page_load_ms
  FROM sess s
  LEFT JOIN conv c USING (device, network)
  ORDER BY conversion_rate DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_audience_device_network IS 
  'Returns conversion performance by device and network type with page load metrics.';

GRANT EXECUTE ON FUNCTION public.get_audience_device_network TO authenticated, service_role;

-- =====================================================================
-- 4. COHORT RETENTION (Weekly First-Purchase Cohorts)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_audience_cohorts(
  p_org_id UUID,
  p_weeks INTEGER DEFAULT 12
)
RETURNS TABLE(
  cohort_week DATE,
  week_offset INTEGER,
  buyers BIGINT,
  retention_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH firsts AS (
    SELECT 
      o.user_id,
      DATE_TRUNC('week', MIN(o.created_at))::DATE AS cohort_week,
      COUNT(*) OVER (PARTITION BY DATE_TRUNC('week', MIN(o.created_at))) AS cohort_size
    FROM ticketing.orders o
    WHERE o.status IN ('paid', 'refunded')
      AND EXISTS (
        SELECT 1 FROM events.events ev
        WHERE ev.id = o.event_id
          AND ev.owner_context_type = 'organization'
          AND ev.owner_context_id = p_org_id
      )
    GROUP BY o.user_id
  ),
  activity AS (
    SELECT 
      o.user_id,
      DATE_TRUNC('week', o.created_at)::DATE AS activity_week
    FROM ticketing.orders o
    WHERE o.status IN ('paid', 'refunded')
      AND EXISTS (
        SELECT 1 FROM events.events ev
        WHERE ev.id = o.event_id
          AND ev.owner_context_type = 'organization'
          AND ev.owner_context_id = p_org_id
      )
  )
  SELECT 
    f.cohort_week,
    FLOOR((a.activity_week - f.cohort_week) / 7.0)::INTEGER AS week_offset,
    COUNT(DISTINCT a.user_id) AS buyers,
    ROUND(100.0 * COUNT(DISTINCT a.user_id)::NUMERIC / NULLIF(MAX(f.cohort_size), 0), 1) AS retention_rate
  FROM firsts f
  JOIN activity a ON a.user_id = f.user_id
  WHERE a.activity_week >= f.cohort_week 
    AND a.activity_week < f.cohort_week + (p_weeks || ' weeks')::INTERVAL
    AND f.cohort_week >= CURRENT_DATE - (p_weeks || ' weeks')::INTERVAL
  GROUP BY f.cohort_week, week_offset
  ORDER BY cohort_week DESC, week_offset;
END;
$$;

COMMENT ON FUNCTION public.get_audience_cohorts IS 
  'Returns weekly cohort retention data showing repeat purchase behavior.';

GRANT EXECUTE ON FUNCTION public.get_audience_cohorts TO authenticated, service_role;

-- =====================================================================
-- 5. USER PATHWAYS (Common Sequences to Purchase)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_audience_paths(
  p_org_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  path TEXT,
  users BIGINT,
  avg_time_to_purchase_minutes INTEGER,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH sequences AS (
    SELECT
      COALESCE(user_id::TEXT, session_id) AS user_key,
      STRING_AGG(
        DISTINCT event_name, 
        ' → ' 
        ORDER BY event_name
      ) AS path,
      EXTRACT(EPOCH FROM (MAX(ts) - MIN(ts))) / 60 AS minutes
    FROM analytics.events
    WHERE org_id = p_org_id
      AND ts BETWEEN p_from AND p_to
      AND event_name IN ('page_view', 'event_view', 'ticket_cta_click', 'checkout_started', 'purchase')
      AND NOT is_bot
      AND NOT is_internal
    GROUP BY user_key
    HAVING COUNT(DISTINCT event_name) >= 2
  ),
  path_stats AS (
    SELECT
      s.path,
      COUNT(*) AS users,
      ROUND(AVG(s.minutes)) AS avg_minutes,
      COUNT(*) FILTER (WHERE s.path LIKE '%purchase%')::NUMERIC / COUNT(*) * 100 AS conv_rate
    FROM sequences s
    GROUP BY s.path
  )
  SELECT 
    path,
    users,
    avg_minutes::INTEGER AS avg_time_to_purchase_minutes,
    ROUND(conv_rate, 1) AS conversion_rate
  FROM path_stats
  WHERE users >= 5  -- Minimum sample size
  ORDER BY users DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_audience_paths IS 
  'Returns most common user pathways to purchase with timing and conversion data.';

GRANT EXECUTE ON FUNCTION public.get_audience_paths TO authenticated, service_role;

-- =====================================================================
-- 6. MATERIALIZE SEGMENT (Export Users Matching Filters)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.materialize_segment(
  p_segment_id UUID
)
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  display_name TEXT,
  propensity_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_definition JSONB;
  v_org_id UUID;
  v_user_role TEXT;
BEGIN
  -- Get segment definition
  SELECT definition, org_id INTO v_definition, v_org_id
  FROM analytics.audience_segments
  WHERE id = p_segment_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Segment not found';
  END IF;
  
  -- Check user has permission to export PII
  SELECT om.role INTO v_user_role
  FROM organizations.org_memberships om
  WHERE om.org_id = v_org_id
    AND om.user_id = auth.uid();
  
  IF v_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Insufficient permissions to export segment';
  END IF;
  
  -- Build query based on definition
  RETURN QUERY
  SELECT DISTINCT
    ac.user_id,
    CASE 
      WHEN v_user_role IN ('owner', 'admin') THEN u.email
      ELSE 'redacted@privacy.local'  -- PII protection
    END AS email,
    up.display_name,
    ac.propensity_score
  FROM analytics.audience_customers ac
  LEFT JOIN auth.users u ON u.id = ac.user_id
  LEFT JOIN users.user_profiles up ON up.user_id = ac.user_id
  WHERE ac.org_id = v_org_id
    -- Apply filters from definition
    AND (v_definition->>'utm_source' IS NULL OR ac.first_touch_source = v_definition->>'utm_source')
    AND (v_definition->>'device_type' IS NULL OR ac.primary_device = v_definition->>'device_type')
    AND (
      (v_definition->>'not_purchased')::BOOLEAN IS NULL 
      OR (v_definition->>'not_purchased')::BOOLEAN = (ac.orders_count = 0)
    )
    AND (
      (v_definition->'viewed_events'->>'min')::INTEGER IS NULL
      OR ac.events_viewed >= (v_definition->'viewed_events'->>'min')::INTEGER
    )
    AND (
      (v_definition->'propensity_score'->>'min')::INTEGER IS NULL
      OR ac.propensity_score >= (v_definition->'propensity_score'->>'min')::INTEGER
    )
  LIMIT 10000;  -- Safety limit
END;
$$;

COMMENT ON FUNCTION public.materialize_segment IS 
  'Exports users matching segment filters. PII-gated to admin/owner roles only.';

GRANT EXECUTE ON FUNCTION public.materialize_segment TO authenticated, service_role;

-- =====================================================================
-- 7. CALCULATE PROPENSITY SCORE
-- =====================================================================

CREATE OR REPLACE FUNCTION analytics.calculate_propensity_score(
  p_user_id UUID,
  p_org_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_score INTEGER := 0;
  v_recent_cta_count INTEGER;
  v_recent_checkout_count INTEGER;
  v_is_repeat_visitor BOOLEAN;
  v_has_slow_network BOOLEAN;
  v_orders_count INTEGER;
BEGIN
  -- Get recent activity (last 7 days)
  SELECT 
    COUNT(*) FILTER (WHERE event_name IN ('ticket_cta_click', 'get_tickets_click')),
    COUNT(*) FILTER (WHERE event_name = 'checkout_started'),
    COUNT(DISTINCT DATE(ts)) > 1,
    BOOL_OR(network_type IN ('3g', '2g'))
  INTO 
    v_recent_cta_count,
    v_recent_checkout_count,
    v_is_repeat_visitor,
    v_has_slow_network
  FROM analytics.events
  WHERE user_id = p_user_id
    AND org_id = p_org_id
    AND ts >= NOW() - INTERVAL '7 days';
  
  -- Get order history
  SELECT COUNT(*)
  INTO v_orders_count
  FROM ticketing.orders o
  WHERE o.user_id = p_user_id
    AND o.status IN ('paid', 'refunded')
    AND EXISTS (
      SELECT 1 FROM events.events ev
      WHERE ev.id = o.event_id
        AND ev.owner_context_type = 'organization'
        AND ev.owner_context_id = p_org_id
    );
  
  -- Calculate score (0-10)
  v_score := LEAST(10, GREATEST(0,
    CASE WHEN v_recent_cta_count > 0 THEN 3 ELSE 0 END +
    CASE WHEN v_recent_checkout_count > 0 THEN 4 ELSE 0 END +
    CASE WHEN v_is_repeat_visitor THEN 1 ELSE 0 END +
    CASE WHEN v_has_slow_network THEN -2 ELSE 0 END +
    CASE WHEN v_orders_count > 0 THEN 3 ELSE 0 END
  ));
  
  RETURN v_score;
END;
$$;

COMMENT ON FUNCTION analytics.calculate_propensity_score IS 
  'Calculates 0-10 propensity score for likelihood to purchase based on recent activity.';

-- =====================================================================
-- 8. UPDATE CUSTOMER RECORDS (Maintenance Function)
-- =====================================================================

CREATE OR REPLACE FUNCTION analytics.update_audience_customers(
  p_org_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Upsert customer records from orders and events
  INSERT INTO analytics.audience_customers (
    user_id,
    org_id,
    first_seen,
    last_seen,
    first_order_at,
    last_order_at,
    orders_count,
    gross_cents,
    net_cents,
    events_viewed,
    posts_viewed,
    first_touch_source,
    first_touch_medium,
    last_touch_source,
    primary_device,
    propensity_score,
    lifecycle_stage,
    updated_at
  )
  SELECT
    u.user_id,
    p_org_id,
    u.first_event,
    u.last_event,
    o.first_order,
    o.last_order,
    o.order_count,
    o.gross_revenue,
    o.net_revenue,
    u.event_views,
    u.post_views,
    u.first_utm_source,
    u.first_utm_medium,
    u.last_utm_source,
    u.primary_device,
    analytics.calculate_propensity_score(u.user_id, p_org_id),
    CASE 
      WHEN o.order_count >= 4 THEN 'champion'
      WHEN o.order_count >= 2 THEN 'repeat_buyer'
      WHEN o.order_count = 1 THEN 'customer'
      WHEN u.last_event < NOW() - INTERVAL '180 days' THEN 'churned'
      WHEN u.last_event < NOW() - INTERVAL '60 days' THEN 'at_risk'
      ELSE 'prospect'
    END,
    NOW()
  FROM (
    -- User event data
    SELECT
      COALESCE(user_id, analytics.resolve_user_id(session_id, anon_id)) AS user_id,
      MIN(ts) AS first_event,
      MAX(ts) AS last_event,
      COUNT(*) FILTER (WHERE event_name IN ('event_view', 'page_view')) AS event_views,
      COUNT(*) FILTER (WHERE event_name = 'post_view') AS post_views,
      (SELECT utm_source FROM analytics.events e2 
       WHERE e2.user_id = COALESCE(e.user_id, analytics.resolve_user_id(e.session_id, e.anon_id))
       ORDER BY ts ASC LIMIT 1) AS first_utm_source,
      (SELECT utm_medium FROM analytics.events e2 
       WHERE e2.user_id = COALESCE(e.user_id, analytics.resolve_user_id(e.session_id, e.anon_id))
       ORDER BY ts ASC LIMIT 1) AS first_utm_medium,
      (SELECT utm_source FROM analytics.events e2 
       WHERE e2.user_id = COALESCE(e.user_id, analytics.resolve_user_id(e.session_id, e.anon_id))
       ORDER BY ts DESC LIMIT 1) AS last_utm_source,
      MODE() WITHIN GROUP (ORDER BY device_type) AS primary_device
    FROM analytics.events e
    WHERE org_id = p_org_id OR p_org_id IS NULL
      AND user_id IS NOT NULL
      AND NOT is_bot
      AND NOT is_internal
    GROUP BY COALESCE(user_id, analytics.resolve_user_id(session_id, anon_id))
  ) u
  LEFT JOIN (
    -- Order data
    SELECT
      o.user_id,
      MIN(o.created_at) AS first_order,
      MAX(o.created_at) AS last_order,
      COUNT(*) AS order_count,
      SUM(o.total_cents) AS gross_revenue,
      SUM(o.total_cents) - COALESCE(SUM(rl.refund_amount_cents), 0) AS net_revenue
    FROM ticketing.orders o
    LEFT JOIN ticketing.refund_log rl ON rl.order_id = o.id
    WHERE o.status IN ('paid', 'refunded')
      AND (p_org_id IS NULL OR EXISTS (
        SELECT 1 FROM events.events ev
        WHERE ev.id = o.event_id
          AND ev.owner_context_type = 'organization'
          AND ev.owner_context_id = p_org_id
      ))
    GROUP BY o.user_id
  ) o ON o.user_id = u.user_id
  WHERE u.user_id IS NOT NULL
  ON CONFLICT (user_id) DO UPDATE
  SET
    last_seen = EXCLUDED.last_seen,
    last_order_at = EXCLUDED.last_order_at,
    orders_count = EXCLUDED.orders_count,
    gross_cents = EXCLUDED.gross_cents,
    net_cents = EXCLUDED.net_cents,
    events_viewed = EXCLUDED.events_viewed,
    posts_viewed = EXCLUDED.posts_viewed,
    last_touch_source = EXCLUDED.last_touch_source,
    propensity_score = EXCLUDED.propensity_score,
    lifecycle_stage = EXCLUDED.lifecycle_stage,
    updated_at = NOW();
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION analytics.update_audience_customers IS 
  'Updates audience_customers table from events and orders. Run nightly via cron.';

GRANT EXECUTE ON FUNCTION analytics.update_audience_customers TO service_role;

-- =====================================================================
-- MIGRATION COMPLETE - AUDIENCE INTELLIGENCE RPCS
-- =====================================================================

-- Summary:
-- ✅ get_audience_overview() - Visitors, sessions, conversion rates
-- ✅ get_audience_acquisition() - Quality by source/medium/campaign
-- ✅ get_audience_device_network() - Performance by device/network
-- ✅ get_audience_cohorts() - Retention curves
-- ✅ get_audience_paths() - Common purchase sequences
-- ✅ materialize_segment() - Export segment with PII controls
-- ✅ calculate_propensity_score() - Likelihood to purchase
-- ✅ update_audience_customers() - Maintenance function
--
-- Next: Create materialized views for performance

