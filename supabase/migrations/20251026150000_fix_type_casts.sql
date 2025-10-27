-- Fix type casting issues in ad tracking functions
-- Placement is an ENUM, request_id is UUID

BEGIN;

-- Fix log_impression_and_charge to cast types properly
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
  -- Insert impression (cast placement to ad_placement, request_id to UUID)
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
    p_placement::ad_placement,  -- Cast to ENUM (no schema prefix)
    p_request_id::UUID,         -- Cast to UUID
    p_pct_visible,
    p_dwell_ms,
    p_viewable,
    NOW()
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING id INTO v_impression_id;

  -- If duplicate, return early
  IF v_impression_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 0::NUMERIC(18,6);
    RETURN;
  END IF;

  -- CPM BILLING WITH FRACTIONAL ACCUMULATOR
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

  RETURN QUERY SELECT v_impression_id, v_charge;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_impression_and_charge TO anon, authenticated, service_role;

-- Fix log_click_and_charge to cast request_id to UUID
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
  -- Insert click (cast request_id to UUID)
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
    p_request_id::UUID,      -- Cast to UUID
    p_ip_address::INET,      -- Cast to INET
    p_user_agent,
    NOW()
  )
  ON CONFLICT (request_id) DO NOTHING
  RETURNING id INTO v_click_id;

  -- If duplicate, return early
  IF v_click_id IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, 0::NUMERIC(18,6);
    RETURN;
  END IF;

  -- CPC BILLING
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

  RETURN QUERY SELECT v_click_id, v_charge;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_click_and_charge TO anon, authenticated, service_role;

COMMIT;

