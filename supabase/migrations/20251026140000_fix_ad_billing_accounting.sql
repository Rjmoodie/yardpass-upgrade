-- =====================================================
-- Fix Ad Billing & Accounting Issues
-- =====================================================
-- This migration fixes:
-- 1. CPM over-charging (fractional credit accumulator)
-- 2. Type mismatches (INTEGER → NUMERIC for money)
-- 3. Invalid ON CONFLICT syntax (proper UNIQUE constraints)
-- 4. Viewability enforcement for CPM billing
-- 5. Session fallback for anonymous attribution
-- =====================================================

BEGIN;

-- =====================================================
-- 1. DROP DEPENDENT VIEWS & MATERIALIZED VIEWS FIRST
-- =====================================================

-- Drop regular views
DROP VIEW IF EXISTS public.campaigns CASCADE;
DROP VIEW IF EXISTS public.campaigns_overview CASCADE;

-- Drop ALL materialized views that depend on ad_spend_ledger.credits_charged
DROP MATERIALIZED VIEW IF EXISTS public.campaign_analytics_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.creative_analytics_daily CASCADE;
DROP MATERIALIZED VIEW IF EXISTS campaigns.campaigns_overview_mv CASCADE;

-- =====================================================
-- 2. FIX TYPE MISMATCHES: INTEGER → NUMERIC
-- =====================================================

-- Update campaigns table to use NUMERIC for credits
ALTER TABLE campaigns.campaigns
  ALTER COLUMN spent_credits TYPE NUMERIC(18,6) USING COALESCE(spent_credits, 0)::NUMERIC(18,6),
  ALTER COLUMN total_budget_credits TYPE NUMERIC(18,6) USING COALESCE(total_budget_credits, 0)::NUMERIC(18,6),
  ALTER COLUMN daily_budget_credits TYPE NUMERIC(18,6) USING COALESCE(daily_budget_credits, 0)::NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS spend_accrual NUMERIC(18,6) DEFAULT 0;

-- Update ad_spend_ledger to use NUMERIC for credits
ALTER TABLE campaigns.ad_spend_ledger
  ALTER COLUMN credits_charged TYPE NUMERIC(18,6) USING COALESCE(credits_charged, 0)::NUMERIC(18,6);

-- Update ad_conversions to use NUMERIC for value
ALTER TABLE campaigns.ad_conversions
  ALTER COLUMN value_cents TYPE NUMERIC(18,6) USING COALESCE(value_cents, 0)::NUMERIC(18,6);

-- =====================================================
-- 2. FIX ON CONFLICT: Add Proper UNIQUE Constraints
-- =====================================================

-- Drop old partial indexes if they exist
DROP INDEX IF EXISTS campaigns.idx_ad_impressions_request_dedup;
DROP INDEX IF EXISTS campaigns.idx_ad_clicks_request_dedup;
DROP INDEX IF EXISTS campaigns.idx_ad_conversions_request_dedup;

-- Add proper UNIQUE constraints (allows multiple NULLs naturally)
ALTER TABLE campaigns.ad_impressions
  DROP CONSTRAINT IF EXISTS ad_impressions_request_uidx,
  ADD CONSTRAINT ad_impressions_request_uidx UNIQUE (request_id);

ALTER TABLE campaigns.ad_clicks
  DROP CONSTRAINT IF EXISTS ad_clicks_request_uidx,
  ADD CONSTRAINT ad_clicks_request_uidx UNIQUE (request_id);

ALTER TABLE campaigns.ad_conversions
  DROP CONSTRAINT IF EXISTS ad_conversions_request_uidx,
  ADD CONSTRAINT ad_conversions_request_uidx UNIQUE (request_id);

-- =====================================================
-- 3. REBUILD: log_impression_and_charge WITH ACCUMULATOR
-- =====================================================

DROP FUNCTION IF EXISTS public.log_impression_and_charge CASCADE;

CREATE OR REPLACE FUNCTION public.log_impression_and_charge(
  p_campaign_id UUID,
  p_creative_id UUID,
  p_user_id UUID,
  p_session_id TEXT,
  p_placement TEXT,
  p_pricing_model TEXT,
  p_rate_credits NUMERIC(12,4),
  p_request_id TEXT DEFAULT NULL,
  p_pct_visible INTEGER DEFAULT 0,
  p_dwell_ms INTEGER DEFAULT 0,
  p_viewable BOOLEAN DEFAULT FALSE,
  p_freq_cap_per_day INTEGER DEFAULT NULL
)
RETURNS TABLE(impression_id UUID, charged_credits NUMERIC(18,6))
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_impression_id UUID;
  v_charge NUMERIC(18,6) := 0;
  v_acc NUMERIC(18,6);
  v_whole NUMERIC(18,6);
  v_is_viewable BOOLEAN;
BEGIN
  -- Insert impression (dedup by request_id or hour_bucket)
  INSERT INTO campaigns.ad_impressions (
    campaign_id,
    creative_id,
    user_id,
    session_id,
    placement,
    request_id,
    pct_visible,
    dwell_ms,
    viewable,
    created_at
  )
  VALUES (
    p_campaign_id,
    p_creative_id,
    p_user_id,
    p_session_id,
    p_placement,
    p_request_id,
    p_pct_visible,
    p_dwell_ms,
    p_viewable,
    NOW()
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING id INTO v_impression_id;

  -- If duplicate (no impression created), return early
  IF v_impression_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 0::NUMERIC(18,6);
    RETURN;
  END IF;

  -- =====================================================
  -- CPM BILLING WITH FRACTIONAL ACCUMULATOR
  -- =====================================================
  IF p_pricing_model = 'cpm' AND p_rate_credits > 0 THEN
    -- Determine viewability (IAB standard: ≥50% visible for ≥1s)
    v_is_viewable := p_viewable OR (p_pct_visible >= 50 AND p_dwell_ms >= 1000);

    -- Only charge if viewable
    IF v_is_viewable THEN
      -- Add fractional cost for THIS impression (CPM rate / 1000)
      UPDATE campaigns.campaigns
      SET spend_accrual = COALESCE(spend_accrual, 0) + (p_rate_credits / 1000.0)
      WHERE id = p_campaign_id
      RETURNING spend_accrual INTO v_acc;

      -- Convert whole credits to ledger
      v_whole := FLOOR(v_acc);
      IF v_whole >= 1 THEN
        -- Log whole credits to spend ledger
        INSERT INTO campaigns.ad_spend_ledger (
          campaign_id,
          creative_id,
          metric_type,
          quantity,
          rate_model,
          credits_charged,
          occurred_at
        )
        VALUES (
          p_campaign_id,
          p_creative_id,
          'impression',
          1,
          'cpm',
          v_whole,
          NOW()
        );

        -- Deduct whole credits from accrual, add to spent_credits
        UPDATE campaigns.campaigns
        SET 
          spent_credits = COALESCE(spent_credits, 0) + v_whole,
          spend_accrual = spend_accrual - v_whole
        WHERE id = p_campaign_id;

        v_charge := v_whole;
      END IF;
    END IF;
  END IF;

  -- Return impression_id and credits charged this call
  RETURN QUERY SELECT v_impression_id, v_charge;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_impression_and_charge TO anon, authenticated, service_role;

-- =====================================================
-- 4. REBUILD: log_click_and_charge WITH PROPER CPC
-- =====================================================

DROP FUNCTION IF EXISTS public.log_click_and_charge CASCADE;

CREATE OR REPLACE FUNCTION public.log_click_and_charge(
  p_impression_id UUID,
  p_campaign_id UUID,
  p_creative_id UUID,
  p_user_id UUID,
  p_session_id TEXT,
  p_pricing_model TEXT,
  p_bid_credits NUMERIC(12,4),
  p_request_id TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE(click_id UUID, charged_credits NUMERIC(18,6))
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_click_id UUID;
  v_charge NUMERIC(18,6) := 0;
BEGIN
  -- Insert click (dedup by request_id)
  INSERT INTO campaigns.ad_clicks (
    impression_id,
    campaign_id,
    creative_id,
    user_id,
    session_id,
    request_id,
    ip_address,
    user_agent,
    created_at
  )
  VALUES (
    p_impression_id,
    p_campaign_id,
    p_creative_id,
    p_user_id,
    p_session_id,
    p_request_id,
    p_ip_address,
    p_user_agent,
    NOW()
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING id INTO v_click_id;

  -- If duplicate (no click created), return early
  IF v_click_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 0::NUMERIC(18,6);
    RETURN;
  END IF;

  -- =====================================================
  -- CPC BILLING (charge full bid per click)
  -- =====================================================
  IF p_pricing_model = 'cpc' AND p_bid_credits > 0 THEN
    v_charge := p_bid_credits;

    -- Log to spend ledger
    INSERT INTO campaigns.ad_spend_ledger (
      campaign_id,
      creative_id,
      metric_type,
      quantity,
      rate_model,
      credits_charged,
      occurred_at
    )
    VALUES (
      p_campaign_id,
      p_creative_id,
      'click',
      1,
      'cpc',
      v_charge,
      NOW()
    );

    -- Increment spent_credits
    UPDATE campaigns.campaigns
    SET spent_credits = COALESCE(spent_credits, 0) + v_charge
    WHERE id = p_campaign_id;
  END IF;

  -- Return click_id and credits charged
  RETURN QUERY SELECT v_click_id, v_charge;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_click_and_charge TO anon, authenticated, service_role;

-- =====================================================
-- 5. REBUILD: attribute_conversion WITH SESSION FALLBACK
-- =====================================================

DROP FUNCTION IF EXISTS campaigns.attribute_conversion CASCADE;

CREATE OR REPLACE FUNCTION campaigns.attribute_conversion(
  p_user_id UUID,
  p_session_id TEXT,
  p_event_type TEXT,
  p_value_cents NUMERIC(18,6) DEFAULT 0,
  p_request_id TEXT DEFAULT NULL
)
RETURNS TABLE(conversion_id UUID, attribution_type TEXT, campaign_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversion_id UUID;
  v_attribution_type TEXT;
  v_campaign_id UUID;
  v_creative_id UUID;
  v_impression_id UUID;
  v_click_id UUID;
BEGIN
  -- =====================================================
  -- LAST-CLICK ATTRIBUTION (7-day window)
  -- =====================================================
  SELECT 
    c.campaign_id,
    c.creative_id,
    c.impression_id,
    c.id
  INTO 
    v_campaign_id,
    v_creative_id,
    v_impression_id,
    v_click_id
  FROM campaigns.ad_clicks c
  LEFT JOIN campaigns.ad_impressions i ON i.id = c.impression_id
  WHERE 
    (c.user_id = p_user_id OR (p_user_id IS NULL AND c.session_id = p_session_id))
    AND c.created_at >= NOW() - INTERVAL '7 days'
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_campaign_id IS NOT NULL THEN
    v_attribution_type := 'last_click';
  ELSE
    -- =====================================================
    -- VIEW-THROUGH ATTRIBUTION (1-day window)
    -- =====================================================
    SELECT 
      i.campaign_id,
      i.creative_id,
      i.id
    INTO 
      v_campaign_id,
      v_creative_id,
      v_impression_id
    FROM campaigns.ad_impressions i
    WHERE 
      (i.user_id = p_user_id OR (p_user_id IS NULL AND i.session_id = p_session_id))
      AND i.created_at >= NOW() - INTERVAL '1 day'
      AND i.viewable = TRUE
    ORDER BY i.created_at DESC
    LIMIT 1;

    IF v_campaign_id IS NOT NULL THEN
      v_attribution_type := 'view_through';
    END IF;
  END IF;

  -- No attribution found
  IF v_campaign_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- =====================================================
  -- INSERT CONVERSION (dedup by request_id)
  -- =====================================================
  INSERT INTO campaigns.ad_conversions (
    campaign_id,
    creative_id,
    impression_id,
    click_id,
    user_id,
    session_id,
    event_type,
    value_cents,
    attribution_type,
    request_id,
    created_at
  )
  VALUES (
    v_campaign_id,
    v_creative_id,
    v_impression_id,
    v_click_id,
    p_user_id,
    p_session_id,
    p_event_type,
    p_value_cents,
    v_attribution_type,
    p_request_id,
    NOW()
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING id INTO v_conversion_id;

  -- Return conversion details
  RETURN QUERY SELECT v_conversion_id, v_attribution_type, v_campaign_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION campaigns.attribute_conversion TO anon, authenticated, service_role;

-- =====================================================
-- 6. RECREATE DEPENDENT VIEWS
-- =====================================================

-- Recreate public.campaigns view
CREATE VIEW public.campaigns AS
SELECT 
  id,
  org_id,
  name,
  description,
  objective,
  status,
  pacing_strategy,
  total_budget_credits,
  daily_budget_credits,
  spent_credits,
  spend_accrual,
  start_date,
  end_date,
  timezone,
  created_by,
  created_at,
  updated_at,
  pricing_model
FROM campaigns.campaigns;

COMMENT ON VIEW public.campaigns IS 'Public view of campaigns.campaigns for API access (with NUMERIC credits)';

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;

-- Recreate public.campaigns_overview view
CREATE VIEW public.campaigns_overview AS
WITH creative_counts AS (
  SELECT
    ac.campaign_id,
    COUNT(*) AS total_creatives,
    COUNT(*) FILTER (WHERE ac.active) AS active_creatives,
    MAX(ac.updated_at) AS last_creative_update
  FROM campaigns.ad_creatives ac
  GROUP BY ac.campaign_id
),
ledger_totals AS (
  SELECT
    l.campaign_id,
    SUM(l.credits_charged) AS total_credits_spent,
    SUM(l.credits_charged) FILTER (WHERE l.occurred_at >= (NOW() - INTERVAL '7 days')) AS credits_last_7d,
    SUM(l.credits_charged) FILTER (WHERE l.occurred_at >= (NOW() - INTERVAL '30 days')) AS credits_last_30d,
    SUM(l.quantity) FILTER (WHERE l.metric_type = 'impression' AND l.occurred_at >= (NOW() - INTERVAL '7 days')) AS impressions_last_7d,
    SUM(l.quantity) FILTER (WHERE l.metric_type = 'click' AND l.occurred_at >= (NOW() - INTERVAL '7 days')) AS clicks_last_7d,
    MAX(l.occurred_at) AS last_spend_at
  FROM campaigns.ad_spend_ledger l
  GROUP BY l.campaign_id
),
delivery_events AS (
  SELECT
    i.campaign_id,
    MAX(i.created_at) AS last_impression_at,
    COUNT(*) FILTER (WHERE i.created_at >= (NOW() - INTERVAL '7 days')) AS impressions_events_7d
  FROM campaigns.ad_impressions i
  GROUP BY i.campaign_id
),
click_events AS (
  SELECT
    c.campaign_id,
    MAX(c.created_at) AS last_click_at,
    COUNT(*) FILTER (WHERE c.created_at >= (NOW() - INTERVAL '7 days')) AS clicks_events_7d
  FROM campaigns.ad_clicks c
  GROUP BY c.campaign_id
)
SELECT
  base.id,
  base.org_id,
  base.created_by,
  base.name,
  base.description,
  base.objective,
  base.status,
  base.total_budget_credits,
  base.daily_budget_credits,
  COALESCE(ledger.total_credits_spent, base.spent_credits) AS spent_credits,
  base.start_date,
  base.end_date,
  base.timezone,
  base.pacing_strategy,
  base.frequency_cap_per_user,
  base.frequency_cap_period,
  base.created_at,
  base.updated_at,
  base.archived_at,
  COALESCE(creative.total_creatives, 0) AS total_creatives,
  COALESCE(creative.active_creatives, 0) AS active_creatives,
  ledger.credits_last_7d,
  ledger.credits_last_30d,
  ledger.impressions_last_7d,
  ledger.clicks_last_7d,
  COALESCE(delivery.last_impression_at, ledger.last_spend_at, base.updated_at) AS last_activity_at,
  delivery.last_impression_at,
  click_evt.last_click_at,
  CASE
    WHEN base.status IN ('archived', 'completed') THEN base.status::TEXT
    WHEN COALESCE(creative.active_creatives, 0) = 0 THEN 'no-creatives'
    WHEN base.start_date > NOW() THEN 'scheduled'
    WHEN base.end_date IS NOT NULL AND base.end_date < NOW() THEN 'completed'
    WHEN COALESCE(ledger.credits_last_7d, 0) = 0 AND base.status = 'active' THEN 'at-risk'
    ELSE base.status::TEXT
  END AS delivery_status,
  CASE
    WHEN base.status IN ('archived', 'completed') THEN 'complete'
    WHEN COALESCE(ledger.credits_last_7d, 0) = 0 THEN 'stalled'
    WHEN base.daily_budget_credits IS NOT NULL 
      AND COALESCE(ledger.credits_last_7d, 0) < base.daily_budget_credits * 2 THEN 'slow'
    WHEN base.daily_budget_credits IS NOT NULL 
      AND COALESCE(ledger.credits_last_7d, 0) > base.daily_budget_credits * 9 THEN 'accelerating'
    ELSE 'on-track'
  END AS pacing_health
FROM campaigns.campaigns base
LEFT JOIN creative_counts creative ON creative.campaign_id = base.id
LEFT JOIN ledger_totals ledger ON ledger.campaign_id = base.id
LEFT JOIN delivery_events delivery ON delivery.campaign_id = base.id
LEFT JOIN click_events click_evt ON click_evt.campaign_id = base.id;

COMMENT ON VIEW public.campaigns_overview IS 'Campaign overview with NUMERIC credits and delivery metrics';
GRANT SELECT ON public.campaigns_overview TO authenticated, service_role;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check campaign credit types
SELECT 
  'campaigns.spent_credits' AS field,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_schema = 'campaigns'
  AND table_name = 'campaigns'
  AND column_name = 'spent_credits';

-- Check ledger credit types
SELECT 
  'ad_spend_ledger.credits_charged' AS field,
  data_type,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE table_schema = 'campaigns'
  AND table_name = 'ad_spend_ledger'
  AND column_name = 'credits_charged';

-- Check constraints
SELECT
  constraint_name,
  table_name
FROM information_schema.table_constraints
WHERE table_schema = 'campaigns'
  AND constraint_type = 'UNIQUE'
  AND constraint_name LIKE '%request%';

