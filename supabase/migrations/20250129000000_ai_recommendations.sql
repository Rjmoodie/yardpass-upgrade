-- ==========================================
-- AI Recommendations System
-- ==========================================
-- Adds AI-powered spend optimization features:
-- 1. Category benchmarks for comparison
-- 2. RPCs to apply recommendations
-- 3. Telemetry to track adoption and measure lift

-- ==========================================
-- 1. Category Benchmarks View
-- ==========================================
-- Provides median CTR and spend for comparison
CREATE OR REPLACE VIEW analytics.category_benchmarks AS
SELECT
  'general' as category,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY 
    CASE WHEN impressions > 0 
    THEN (clicks::numeric / impressions) * 100 
    ELSE 0 END
  ) as ctr_median,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY spend_credits) as spend_median,
  COUNT(DISTINCT campaign_id) as sample_size
FROM public.analytics_campaign_daily
WHERE day >= CURRENT_DATE - INTERVAL '30 days'
  AND impressions > 10; -- Filter noise

COMMENT ON VIEW analytics.category_benchmarks IS 
  'Median CTR and spend benchmarks across all campaigns (last 30 days)';

-- Expose category_benchmarks via public synonym for PostgREST
CREATE OR REPLACE VIEW public.category_benchmarks AS
SELECT * FROM analytics.category_benchmarks;

GRANT SELECT ON public.category_benchmarks TO authenticated, anon;

COMMENT ON VIEW public.category_benchmarks IS
  'Public access to category benchmarks (via PostgREST)';

-- Helper RPC to fetch campaign data (campaigns schema not exposed to PostgREST)
CREATE OR REPLACE FUNCTION public.get_campaign_for_ai(p_campaign_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  daily_budget_credits NUMERIC,
  total_budget_credits NUMERIC,
  spent_credits NUMERIC,
  bidding JSONB,
  freq_cap JSONB,
  frequency_cap_per_user INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.daily_budget_credits,
    c.total_budget_credits,
    c.spent_credits,
    c.bidding,
    c.freq_cap,
    c.frequency_cap_per_user
  FROM campaigns.campaigns c
  WHERE c.id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_campaign_for_ai TO authenticated, anon;

-- ==========================================
-- 2. Apply Recommendation RPCs
-- ==========================================

-- 2a. Increase daily budget by percentage
CREATE OR REPLACE FUNCTION public.campaign_increase_daily_budget(
  p_campaign_id uuid,
  p_amount_pct int
) RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old numeric;
  v_new numeric;
  v_org_id uuid;
  v_user_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get campaign details and verify access
  SELECT daily_budget_credits, org_id 
  INTO v_old, v_org_id
  FROM campaigns.campaigns
  WHERE id = p_campaign_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;
  
  -- Verify user has access to this campaign's org
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE org_id = v_org_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Calculate new budget
  v_new := CEIL(COALESCE(v_old, 0) * (1 + p_amount_pct/100.0));
  
  -- Update campaign
  UPDATE campaigns.campaigns
  SET daily_budget_credits = v_new,
      updated_at = now()
  WHERE id = p_campaign_id;
  
  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'old_budget', v_old,
    'new_budget', v_new,
    'increase_pct', p_amount_pct
  );
END$$;

COMMENT ON FUNCTION public.campaign_increase_daily_budget IS
  'AI Recommendation: Increase campaign daily budget by percentage';

-- 2b. Raise CPM/CPC bid
CREATE OR REPLACE FUNCTION public.campaign_raise_cpm(
  p_campaign_id uuid,
  p_amount_pct int
) RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_bid int;
  v_new_bid int;
  v_org_id uuid;
  v_user_id uuid;
  v_bidding jsonb;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get campaign details and verify access
  SELECT bidding, org_id 
  INTO v_bidding, v_org_id
  FROM campaigns.campaigns
  WHERE id = p_campaign_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;
  
  -- Verify user has access
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE org_id = v_org_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Get current bid
  v_old_bid := COALESCE((v_bidding->>'bid_cents')::int, 500);
  v_new_bid := CEIL(v_old_bid * (1 + p_amount_pct/100.0));
  
  -- Update bidding
  UPDATE campaigns.campaigns
  SET bidding = jsonb_set(
        COALESCE(bidding, '{}'::jsonb), 
        '{bid_cents}', 
        to_jsonb(v_new_bid)
      ),
      updated_at = now()
  WHERE id = p_campaign_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'old_bid_cents', v_old_bid,
    'new_bid_cents', v_new_bid,
    'increase_pct', p_amount_pct
  );
END$$;

COMMENT ON FUNCTION public.campaign_raise_cpm IS
  'AI Recommendation: Raise campaign CPM/CPC bid by percentage';

-- 2c. Update frequency cap
CREATE OR REPLACE FUNCTION public.campaign_update_freq_cap(
  p_campaign_id uuid,
  p_new_impressions int,
  p_new_period_hours int DEFAULT 24
) RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_org_id uuid;
  v_user_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get campaign details and verify access
  SELECT freq_cap, org_id 
  INTO v_old, v_org_id
  FROM campaigns.campaigns
  WHERE id = p_campaign_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;
  
  -- Verify user has access
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE org_id = v_org_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Build new freq cap
  v_new := jsonb_build_object(
    'impressions', p_new_impressions,
    'period_hours', p_new_period_hours
  );
  
  -- Update campaign
  UPDATE campaigns.campaigns
  SET freq_cap = v_new,
      frequency_cap_per_user = p_new_impressions, -- Also update flat column
      updated_at = now()
  WHERE id = p_campaign_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'old_freq_cap', v_old,
    'new_freq_cap', v_new
  );
END$$;

COMMENT ON FUNCTION public.campaign_update_freq_cap IS
  'AI Recommendation: Update campaign frequency cap';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.campaign_increase_daily_budget(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_raise_cpm(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_update_freq_cap(uuid, int, int) TO authenticated;

-- ==========================================
-- 3. AI Recommendation Telemetry
-- ==========================================

-- Table to track AI recommendations shown and applied
CREATE TABLE IF NOT EXISTS analytics.ai_recommendation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns.campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  
  -- Recommendation details
  rec_type text NOT NULL, -- 'increase_budget', 'raise_cpm', 'increase_freq_cap', etc.
  rec_title text NOT NULL,
  actions jsonb NOT NULL,
  confidence text CHECK (confidence IN ('low', 'medium', 'high')),
  expected_impact text,
  
  -- Adoption tracking
  was_applied boolean NOT NULL DEFAULT false,
  applied_at timestamptz,
  
  -- Outcome tracking (populated after 7 days)
  baseline_metrics jsonb, -- KPIs before applying
  followup_metrics jsonb, -- KPIs 7 days after
  actual_lift_pct numeric(5,2),
  
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_rec_campaign ON analytics.ai_recommendation_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ai_rec_user ON analytics.ai_recommendation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_rec_applied ON analytics.ai_recommendation_events(was_applied) 
  WHERE was_applied = true;
CREATE INDEX IF NOT EXISTS idx_ai_rec_created ON analytics.ai_recommendation_events(created_at DESC);

COMMENT ON TABLE analytics.ai_recommendation_events IS
  'Tracks AI recommendations shown to users, their adoption, and measured outcomes';

-- Function to log when AI shows a recommendation
CREATE OR REPLACE FUNCTION analytics.log_ai_recommendation(
  p_campaign_id uuid,
  p_rec_type text,
  p_rec_title text,
  p_actions jsonb,
  p_confidence text DEFAULT 'medium',
  p_expected_impact text DEFAULT NULL
) RETURNS uuid 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec_id uuid;
  v_baseline jsonb;
BEGIN
  -- Capture current KPIs as baseline (last 7 days)
  SELECT jsonb_build_object(
    'impressions', COALESCE(SUM(impressions), 0),
    'clicks', COALESCE(SUM(clicks), 0),
    'conversions', COALESCE(SUM(conversions), 0),
    'spend_credits', COALESCE(SUM(spend_credits), 0)
  ) INTO v_baseline
  FROM public.analytics_campaign_daily
  WHERE campaign_id = p_campaign_id
    AND day >= CURRENT_DATE - INTERVAL '7 days';
  
  -- Insert recommendation event
  INSERT INTO analytics.ai_recommendation_events (
    campaign_id,
    user_id,
    rec_type,
    rec_title,
    actions,
    confidence,
    expected_impact,
    baseline_metrics
  ) VALUES (
    p_campaign_id,
    auth.uid(),
    p_rec_type,
    p_rec_title,
    p_actions,
    p_confidence,
    p_expected_impact,
    v_baseline
  ) RETURNING id INTO v_rec_id;
  
  RETURN v_rec_id;
END$$;

COMMENT ON FUNCTION analytics.log_ai_recommendation IS
  'Logs when an AI recommendation is shown to a user';

-- Function to mark recommendation as applied
CREATE OR REPLACE FUNCTION analytics.mark_ai_rec_applied(
  p_rec_id uuid
) RETURNS void 
LANGUAGE sql 
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE analytics.ai_recommendation_events
  SET was_applied = true,
      applied_at = now()
  WHERE id = p_rec_id;
$$;

COMMENT ON FUNCTION analytics.mark_ai_rec_applied IS
  'Marks an AI recommendation as applied by the user';

-- Function to measure actual lift (run 7 days after application)
CREATE OR REPLACE FUNCTION analytics.measure_ai_rec_lift(
  p_rec_id uuid
) RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec record;
  v_followup jsonb;
  v_lift numeric;
BEGIN
  -- Get recommendation details
  SELECT * INTO v_rec
  FROM analytics.ai_recommendation_events
  WHERE id = p_rec_id AND was_applied = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Recommendation not found or not applied'
    );
  END IF;
  
  -- Only measure if applied at least 7 days ago
  IF v_rec.applied_at > now() - INTERVAL '7 days' THEN
    RETURN jsonb_build_object(
      'error', 'Too early to measure lift (need 7 days post-application)'
    );
  END IF;
  
  -- Get metrics 7 days after application
  SELECT jsonb_build_object(
    'impressions', COALESCE(SUM(impressions), 0),
    'clicks', COALESCE(SUM(clicks), 0),
    'conversions', COALESCE(SUM(conversions), 0),
    'spend_credits', COALESCE(SUM(spend_credits), 0)
  ) INTO v_followup
  FROM public.analytics_campaign_daily
  WHERE campaign_id = v_rec.campaign_id
    AND day >= v_rec.applied_at::date
    AND day < v_rec.applied_at::date + INTERVAL '7 days';
  
  -- Calculate lift in primary metric (impressions)
  v_lift := (
    (v_followup->>'impressions')::numeric - 
    (v_rec.baseline_metrics->>'impressions')::numeric
  ) / NULLIF((v_rec.baseline_metrics->>'impressions')::numeric, 0) * 100;
  
  -- Update the record
  UPDATE analytics.ai_recommendation_events
  SET followup_metrics = v_followup,
      actual_lift_pct = v_lift
  WHERE id = p_rec_id;
  
  RETURN jsonb_build_object(
    'rec_id', p_rec_id,
    'baseline', v_rec.baseline_metrics,
    'followup', v_followup,
    'lift_pct', v_lift,
    'expected_impact', v_rec.expected_impact
  );
END$$;

COMMENT ON FUNCTION analytics.measure_ai_rec_lift IS
  'Measures actual performance lift 7 days after applying an AI recommendation';

-- Grant permissions for telemetry functions
GRANT EXECUTE ON FUNCTION analytics.log_ai_recommendation TO authenticated;
GRANT EXECUTE ON FUNCTION analytics.mark_ai_rec_applied TO authenticated;
GRANT EXECUTE ON FUNCTION analytics.measure_ai_rec_lift TO service_role;

-- ==========================================
-- 4. Helper Views for AI Dashboard
-- ==========================================

-- View to show recommendation adoption rates
CREATE OR REPLACE VIEW analytics.ai_recommendation_stats AS
SELECT
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as total_recs_shown,
  COUNT(*) FILTER (WHERE was_applied) as total_applied,
  ROUND(
    COUNT(*) FILTER (WHERE was_applied)::numeric / 
    NULLIF(COUNT(*), 0) * 100, 
    1
  ) as adoption_rate_pct,
  AVG(actual_lift_pct) FILTER (WHERE actual_lift_pct IS NOT NULL) as avg_measured_lift_pct,
  COUNT(*) FILTER (WHERE actual_lift_pct IS NOT NULL) as measured_count
FROM analytics.ai_recommendation_events
GROUP BY 1
ORDER BY 1 DESC;

COMMENT ON VIEW analytics.ai_recommendation_stats IS
  'Weekly stats on AI recommendation adoption and measured lift';

-- ==========================================
-- Success!
-- ==========================================

-- Log successful migration
DO $$ 
BEGIN 
  RAISE NOTICE '✅ AI Recommendations System installed successfully';
  RAISE NOTICE '   - Category benchmarks view created';
  RAISE NOTICE '   - 3 apply recommendation RPCs created';
  RAISE NOTICE '   - Telemetry system ready';
  RAISE NOTICE '   - Helper views created';
END $$;

