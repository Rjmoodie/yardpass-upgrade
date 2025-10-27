-- Fix impression deduplication to handle BOTH unique constraints gracefully
-- This prevents 500 errors when users see the same ad multiple times in the same hour

DROP FUNCTION IF EXISTS public.log_impression_and_charge CASCADE;

CREATE OR REPLACE FUNCTION public.log_impression_and_charge(
  p_campaign_id UUID,
  p_creative_id UUID,
  p_user_id UUID,
  p_session_id TEXT,
  p_event_id UUID,
  p_placement TEXT,
  p_request_id UUID,
  p_pricing_model TEXT,
  p_rate_credits NUMERIC(12,4),
  p_bid_credits NUMERIC(12,4),
  p_viewable BOOLEAN DEFAULT FALSE,
  p_pct_visible INTEGER DEFAULT 0,
  p_dwell_ms INTEGER DEFAULT 0,
  p_freq_cap INTEGER DEFAULT NULL
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
  -- Try to insert impression
  -- Note: We can't use ON CONFLICT with multiple constraints in one INSERT,
  -- so we use exception handling to catch ANY duplicate key violation
  BEGIN
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
      p_placement::ad_placement,
      p_request_id::UUID,
      p_pct_visible,
      p_dwell_ms,
      p_viewable,
      NOW()
    )
    RETURNING id INTO v_impression_id;

  EXCEPTION WHEN unique_violation THEN
    -- Duplicate detected (either request_id or hour_bucket dedup)
    -- This is expected behavior for frequency capping
    -- Return 0 credits charged
    RETURN QUERY SELECT NULL::UUID, 0::NUMERIC(18,6);
    RETURN;
  END;

  -- If we got here, impression was created successfully
  -- Now handle billing

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
-- Also fix log_click_and_charge to handle duplicates gracefully
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
  -- Try to insert click
  BEGIN
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
      p_request_id::UUID,
      p_ip_address::INET,
      p_user_agent,
      NOW()
    )
    RETURNING id INTO v_click_id;

  EXCEPTION WHEN unique_violation THEN
    -- Duplicate click detected (same request_id)
    -- Return 0 credits charged
    RETURN QUERY SELECT NULL::UUID, 0::NUMERIC(18,6);
    RETURN;
  END;

  -- If we got here, click was created successfully
  -- Now handle CPC billing

  IF p_pricing_model = 'cpc' AND p_bid_credits > 0 THEN
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
      p_bid_credits,
      NOW()
    );

    -- Deduct from campaign budget
    UPDATE campaigns.campaigns
    SET spent_credits = COALESCE(spent_credits, 0) + p_bid_credits
    WHERE id = p_campaign_id;

    v_charge := p_bid_credits;
  END IF;

  -- Return click_id and credits charged
  RETURN QUERY SELECT v_click_id, v_charge;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_click_and_charge TO anon, authenticated, service_role;

