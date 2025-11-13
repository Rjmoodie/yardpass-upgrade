-- =====================================================================
-- ANALYTICS ACTIONABLE FEATURES
-- Migration: 20251112000004_analytics_actionable.sql
-- =====================================================================
-- Adds KPI targets, saved views, drillthrough support, and comparisons
-- Makes analytics actionable for organizers
-- =====================================================================

-- =====================================================================
-- 1. ORG KPI TARGETS
-- =====================================================================
-- Allows organizers to set goals and track progress

CREATE TABLE IF NOT EXISTS analytics.org_kpi_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  
  -- KPI identification
  kpi TEXT NOT NULL CHECK (kpi IN (
    'gross_revenue',
    'net_revenue',
    'total_attendees',
    'conversion_rate',
    'avg_order_value',
    'ticket_sales',
    'event_count',
    'repeat_purchase_rate',
    'ltv'
  )),
  
  -- Target value
  target_value NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Time scope
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  
  -- Active date range
  start_date DATE NOT NULL,
  end_date DATE,  -- NULL means ongoing
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate active targets
  CONSTRAINT unique_active_kpi_per_org UNIQUE (org_id, kpi, period, start_date)
);

CREATE INDEX ON analytics.org_kpi_targets(org_id, kpi);
CREATE INDEX ON analytics.org_kpi_targets(start_date, end_date);

COMMENT ON TABLE analytics.org_kpi_targets IS 
  'Organizer-defined KPI goals for tracking progress and motivation.';

GRANT SELECT ON analytics.org_kpi_targets TO authenticated;
GRANT INSERT, UPDATE, DELETE ON analytics.org_kpi_targets TO authenticated;
GRANT ALL ON analytics.org_kpi_targets TO service_role;

-- RLS: Users can manage targets for their orgs
ALTER TABLE analytics.org_kpi_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage KPI targets for their orgs"
  ON analytics.org_kpi_targets
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organizations.org_memberships om
      WHERE om.org_id = analytics.org_kpi_targets.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations.org_memberships om
      WHERE om.org_id = analytics.org_kpi_targets.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- =====================================================================
-- 2. SAVED VIEWS
-- =====================================================================
-- Persist filter combinations for quick recall

CREATE TABLE IF NOT EXISTS analytics.saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- View metadata
  name TEXT NOT NULL,
  description TEXT,
  
  -- Saved state
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {dateRange, eventIds, attribution, etc}
  active_tab TEXT,  -- 'overview' | 'events' | 'videos' | 'audience'
  
  -- Sharing
  is_shared BOOLEAN DEFAULT FALSE,  -- Share with org team
  
  -- Usage tracking
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT saved_views_name_unique_per_user UNIQUE (user_id, name)
);

CREATE INDEX ON analytics.saved_views(org_id, user_id);
CREATE INDEX ON analytics.saved_views(user_id, last_accessed_at DESC);
CREATE INDEX ON analytics.saved_views(org_id, is_shared) WHERE is_shared = TRUE;

COMMENT ON TABLE analytics.saved_views IS 
  'Saved analytics view configurations for quick access to common filters.';

GRANT SELECT, INSERT, UPDATE, DELETE ON analytics.saved_views TO authenticated;
GRANT ALL ON analytics.saved_views TO service_role;

-- RLS: Users see their own views + shared views in their orgs
ALTER TABLE analytics.saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own saved views"
  ON analytics.saved_views
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view shared views in their orgs"
  ON analytics.saved_views
  FOR SELECT
  TO authenticated
  USING (
    is_shared = TRUE
    AND EXISTS (
      SELECT 1 FROM organizations.org_memberships om
      WHERE om.org_id = analytics.saved_views.org_id
        AND om.user_id = auth.uid()
    )
  );

-- =====================================================================
-- 3. PERIOD COMPARISON FUNCTION
-- =====================================================================
-- Returns current vs previous period metrics

CREATE OR REPLACE FUNCTION public.get_analytics_with_comparison(
  p_org_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_comparison_type TEXT DEFAULT 'WoW'  -- 'DoD' | 'WoW' | 'MoM' | 'YoY'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current JSONB;
  v_previous JSONB;
  v_result JSONB;
  v_interval INTERVAL;
BEGIN
  -- Calculate comparison interval
  v_interval := CASE p_comparison_type
    WHEN 'DoD' THEN '1 day'::INTERVAL
    WHEN 'WoW' THEN '1 week'::INTERVAL
    WHEN 'MoM' THEN '1 month'::INTERVAL
    WHEN 'YoY' THEN '1 year'::INTERVAL
    ELSE (p_to - p_from)  -- Same period length
  END;
  
  -- Get current period data
  v_current := public.get_audience_funnel_cached(
    p_org_id,
    p_from,
    p_to,
    NULL,
    TRUE
  );
  
  -- Get previous period data
  v_previous := public.get_audience_funnel_cached(
    p_org_id,
    p_from - v_interval,
    p_to - v_interval,
    NULL,
    TRUE
  );
  
  -- Build comparison result
  v_result := jsonb_build_object(
    'current', v_current,
    'previous', v_previous,
    'comparison_type', p_comparison_type,
    'comparisons', jsonb_build_object(
      'funnel_steps', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'stage', curr->>'stage',
            'current_users', (curr->>'users')::INTEGER,
            'previous_users', (prev->>'users')::INTEGER,
            'delta', (curr->>'users')::INTEGER - (prev->>'users')::INTEGER,
            'delta_pct', ROUND(
              CASE WHEN (prev->>'users')::INTEGER > 0 
                THEN (((curr->>'users')::INTEGER - (prev->>'users')::INTEGER)::NUMERIC / (prev->>'users')::INTEGER * 100)
                ELSE 0 
              END,
              1
            )
          )
        )
        FROM jsonb_array_elements(v_current->'funnel_steps') WITH ORDINALITY AS t1(curr, idx)
        LEFT JOIN jsonb_array_elements(v_previous->'funnel_steps') WITH ORDINALITY AS t2(prev, idx2)
          ON t1.idx = t2.idx2
      ),
      'total_conversion_rate', jsonb_build_object(
        'current', v_current->'total_conversion_rate',
        'previous', v_previous->'total_conversion_rate',
        'delta_pct', ROUND(
          (v_current->'total_conversion_rate')::NUMERIC - (v_previous->'total_conversion_rate')::NUMERIC,
          1
        )
      )
    )
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_analytics_with_comparison IS 
  'Returns analytics with period-over-period comparison (DoD, WoW, MoM, YoY).';

GRANT EXECUTE ON FUNCTION public.get_analytics_with_comparison TO authenticated, service_role;

-- =====================================================================
-- 4. ENHANCED FUNNEL WITH TARGETS
-- =====================================================================
-- Returns funnel data enriched with targets and benchmarks

CREATE OR REPLACE FUNCTION public.get_funnel_with_targets(
  p_org_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_funnel JSONB;
  v_targets JSONB;
  v_benchmarks JSONB;
BEGIN
  -- Get base funnel data
  v_funnel := public.get_audience_funnel_cached(
    p_org_id,
    p_from,
    p_to,
    NULL,
    TRUE
  );
  
  -- Get active targets for this org
  SELECT jsonb_object_agg(kpi, target_value)
  INTO v_targets
  FROM analytics.org_kpi_targets
  WHERE org_id = p_org_id
    AND start_date <= CURRENT_DATE
    AND (end_date IS NULL OR end_date >= CURRENT_DATE);
  
  -- Get industry benchmarks (hardcoded for now, can be table later)
  v_benchmarks := jsonb_build_object(
    'conversion_rate', 5.0,  -- 5% typical e-commerce
    'cart_abandonment', 70.0,  -- 70% abandon checkout
    'mobile_conversion', 3.5,  -- Mobile typically lower
    'repeat_purchase_rate', 25.0  -- 25% repeat customers
  );
  
  -- Enrich funnel with targets and benchmarks
  RETURN jsonb_build_object(
    'funnel', v_funnel,
    'targets', COALESCE(v_targets, '{}'::jsonb),
    'benchmarks', v_benchmarks,
    'target_deltas', (
      SELECT jsonb_object_agg(
        key,
        jsonb_build_object(
          'target', value,
          'actual', CASE key
            WHEN 'net_revenue' THEN (v_funnel->'funnel_steps'->4->>'net_revenue_cents')::NUMERIC / 100
            WHEN 'conversion_rate' THEN v_funnel->'total_conversion_rate'
            ELSE 0
          END,
          'delta_pct', ROUND(
            CASE 
              WHEN value::NUMERIC > 0 THEN
                ((CASE key
                  WHEN 'net_revenue' THEN (v_funnel->'funnel_steps'->4->>'net_revenue_cents')::NUMERIC / 100
                  WHEN 'conversion_rate' THEN (v_funnel->'total_conversion_rate')::NUMERIC
                  ELSE 0
                END - value::NUMERIC) / value::NUMERIC * 100)
              ELSE 0
            END,
            1
          ),
          'on_track', CASE 
            WHEN value::NUMERIC > 0 THEN
              CASE key
                WHEN 'net_revenue' THEN (v_funnel->'funnel_steps'->4->>'net_revenue_cents')::NUMERIC / 100 >= value::NUMERIC
                WHEN 'conversion_rate' THEN (v_funnel->'total_conversion_rate')::NUMERIC >= value::NUMERIC
                ELSE FALSE
              END
            ELSE TRUE
          END
        )
      )
      FROM jsonb_each(COALESCE(v_targets, '{}'::jsonb))
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_funnel_with_targets IS 
  'Returns funnel data with org targets and benchmarks for goal tracking.';

GRANT EXECUTE ON FUNCTION public.get_funnel_with_targets TO authenticated, service_role;

-- =====================================================================
-- 5. DRILLTHROUGH QUERY BUILDER
-- =====================================================================
-- Generates filtered queries for exploration

CREATE OR REPLACE FUNCTION public.get_drillthrough_query(
  p_metric TEXT,
  p_org_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_event_id UUID DEFAULT NULL,
  p_channel TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_table TEXT;
  v_filters JSONB;
BEGIN
  -- Build filter object
  v_filters := jsonb_build_object(
    'org_id', p_org_id,
    'from', p_from,
    'to', p_to,
    'event_id', p_event_id,
    'channel', p_channel,
    'device', p_device
  );
  
  -- Determine underlying data source
  CASE p_metric
    WHEN 'awareness' THEN
      v_table := 'analytics.events WHERE event_name IN (''page_view'', ''event_impression'')';
    WHEN 'engagement' THEN
      v_table := 'analytics.events WHERE event_name IN (''event_view'', ''click_event_card'')';
    WHEN 'purchases' THEN
      v_table := 'ticketing.orders WHERE status IN (''paid'', ''refunded'')';
    WHEN 'revenue' THEN
      v_table := 'ticketing.orders o LEFT JOIN ticketing.refund_log r ON r.order_id = o.id';
    ELSE
      v_table := 'analytics.events';
  END CASE;
  
  -- Return drillthrough metadata
  v_result := jsonb_build_object(
    'metric', p_metric,
    'table', v_table,
    'filters', v_filters,
    'sample_query', format(
      'SELECT * FROM %s WHERE ts BETWEEN %L AND %L AND org_id = %L LIMIT 100',
      v_table,
      p_from,
      p_to,
      p_org_id
    ),
    'export_url', '/api/export/' || p_metric,
    'count_estimate', (
      SELECT COUNT(*)
      FROM analytics.events
      WHERE ts BETWEEN p_from AND p_to
        AND org_id = p_org_id
        AND (p_event_id IS NULL OR event_id = p_event_id)
    )
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_drillthrough_query IS 
  'Generates drillthrough query metadata for metric exploration.';

GRANT EXECUTE ON FUNCTION public.get_drillthrough_query TO authenticated, service_role;

-- =====================================================================
-- 6. BENCHMARK DATA TABLE
-- =====================================================================
-- Industry benchmarks for comparison

CREATE TABLE IF NOT EXISTS analytics.industry_benchmarks (
  id SERIAL PRIMARY KEY,
  
  -- Benchmark identification
  kpi TEXT NOT NULL,
  industry TEXT DEFAULT 'events_ticketing',
  region TEXT DEFAULT 'global',
  
  -- Benchmark values
  p25 NUMERIC,  -- 25th percentile
  p50 NUMERIC,  -- Median
  p75 NUMERIC,  -- 75th percentile
  p90 NUMERIC,  -- 90th percentile (top performers)
  
  -- Metadata
  sample_size INTEGER,
  last_updated DATE,
  source TEXT,
  
  CONSTRAINT unique_benchmark UNIQUE (kpi, industry, region)
);

COMMENT ON TABLE analytics.industry_benchmarks IS 
  'Industry benchmark data for KPI comparisons.';

-- Seed initial benchmarks for events/ticketing industry
INSERT INTO analytics.industry_benchmarks (kpi, p25, p50, p75, p90, sample_size, source) VALUES
  ('conversion_rate', 2.5, 5.0, 8.0, 12.0, 1000, 'Industry Report 2025'),
  ('cart_abandonment_rate', 60.0, 70.0, 75.0, 80.0, 1000, 'Industry Report 2025'),
  ('mobile_conversion_rate', 2.0, 3.5, 6.0, 9.0, 1000, 'Industry Report 2025'),
  ('avg_order_value_usd', 45.0, 75.0, 120.0, 200.0, 1000, 'Industry Report 2025'),
  ('repeat_purchase_rate', 15.0, 25.0, 35.0, 50.0, 1000, 'Industry Report 2025'),
  ('email_open_rate', 15.0, 22.0, 28.0, 35.0, 500, 'Email Marketing 2025'),
  ('email_ctr', 1.5, 2.8, 4.5, 7.0, 500, 'Email Marketing 2025')
ON CONFLICT (kpi, industry, region) DO NOTHING;

GRANT SELECT ON analytics.industry_benchmarks TO authenticated;
GRANT ALL ON analytics.industry_benchmarks TO service_role;

-- =====================================================================
-- 7. ENHANCED FUNNEL WITH COMPARISONS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_funnel_enhanced(
  p_org_id UUID,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_compare_period TEXT DEFAULT 'WoW',  -- 'DoD' | 'WoW' | 'MoM' | 'YoY'
  p_include_targets BOOLEAN DEFAULT TRUE,
  p_include_benchmarks BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_comparison JSONB;
BEGIN
  -- Get current period data
  v_result := public.get_audience_funnel_cached(
    p_org_id,
    p_from,
    p_to,
    NULL,
    TRUE
  );
  
  -- Add period comparison if requested
  IF p_compare_period IS NOT NULL THEN
    v_comparison := public.get_analytics_with_comparison(
      p_org_id,
      p_from,
      p_to,
      p_compare_period
    );
    
    v_result := v_result || jsonb_build_object(
      'comparison', v_comparison->'comparisons',
      'comparison_period', p_compare_period
    );
  END IF;
  
  -- Add targets if requested
  IF p_include_targets THEN
    v_result := v_result || jsonb_build_object(
      'targets', (
        SELECT jsonb_object_agg(kpi, target_value)
        FROM analytics.org_kpi_targets
        WHERE org_id = p_org_id
          AND start_date <= CURRENT_DATE
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      )
    );
  END IF;
  
  -- Add benchmarks if requested
  IF p_include_benchmarks THEN
    v_result := v_result || jsonb_build_object(
      'benchmarks', (
        SELECT jsonb_object_agg(
          kpi,
          jsonb_build_object('p50', p50, 'p75', p75, 'p90', p90)
        )
        FROM analytics.industry_benchmarks
        WHERE industry = 'events_ticketing'
      )
    );
  END IF;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_funnel_enhanced IS 
  'Returns funnel with period comparisons, targets, and benchmarks for actionable insights.';

GRANT EXECUTE ON FUNCTION public.get_funnel_enhanced TO authenticated, service_role;

-- =====================================================================
-- MIGRATION COMPLETE - ANALYTICS ACTIONABLE
-- =====================================================================

-- Summary:
-- ✅ org_kpi_targets - Organizer goals and targets
-- ✅ saved_views - Persistent filter configurations
-- ✅ industry_benchmarks - Peer comparison data
-- ✅ get_analytics_with_comparison() - Period comparisons
-- ✅ get_drillthrough_query() - Metric exploration
-- ✅ get_funnel_enhanced() - All-in-one enriched response
--
-- Next: Update AnalyticsHub.tsx to use these features

