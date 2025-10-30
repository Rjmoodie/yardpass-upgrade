-- Fix CPM billing to add row lock and missing ledger fields
-- This prevents race conditions and ensures audit trail is complete

-- Drop all versions of the function first
DROP FUNCTION IF EXISTS public.log_impression_and_charge CASCADE;

CREATE OR REPLACE FUNCTION public.log_impression_and_charge(
  p_campaign_id UUID,
  p_creative_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_placement TEXT DEFAULT 'feed',
  p_request_id TEXT DEFAULT NULL,
  p_pricing_model TEXT DEFAULT 'cpm',
  p_rate_credits NUMERIC(12,4) DEFAULT 0,
  p_bid_credits NUMERIC(12,4) DEFAULT 0,
  p_viewable BOOLEAN DEFAULT FALSE,
  p_pct_visible INTEGER DEFAULT NULL,
  p_dwell_ms INTEGER DEFAULT NULL,
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
  v_whole INTEGER;
  v_is_viewable BOOLEAN := FALSE;
  v_wallet_id UUID;
BEGIN
  -- Deduplicate: if request_id exists, return existing impression (charged 0)
  IF p_request_id IS NOT NULL THEN
    SELECT id INTO v_impression_id
    FROM campaigns.ad_impressions
    WHERE request_id::TEXT = p_request_id;

    IF FOUND THEN
      RETURN QUERY SELECT v_impression_id, 0::NUMERIC(18,6);
      RETURN;
    END IF;
  END IF;

  -- Try to insert the impression (will fail on unique constraints)
  BEGIN
    INSERT INTO campaigns.ad_impressions (
      campaign_id, creative_id, user_id, session_id, placement, request_id, 
      pct_visible, dwell_ms, viewable, created_at
    ) VALUES (
      p_campaign_id, p_creative_id, p_user_id, p_session_id, 
      p_placement::ad_placement, p_request_id::UUID, 
      p_pct_visible, p_dwell_ms, p_viewable, NOW()
    )
    RETURNING id INTO v_impression_id;
  EXCEPTION WHEN unique_violation THEN
    -- Duplicate detected - return 0 credits charged
    RETURN QUERY SELECT NULL::UUID, 0::NUMERIC(18,6);
    RETURN;
  END;

  -- =====================================================
  -- CPM BILLING WITH FRACTIONAL ACCUMULATOR + ROW LOCK
  -- =====================================================
  IF p_pricing_model = 'cpm' AND p_rate_credits > 0 THEN
    -- Determine viewability (IAB standard: ≥50% visible for ≥1s)
    v_is_viewable := p_viewable OR (p_pct_visible >= 50 AND p_dwell_ms >= 1000);

    -- Only charge if viewable
    IF v_is_viewable THEN
      -- 🔒 LOCK ROW to prevent race conditions
      PERFORM 1 FROM campaigns.campaigns WHERE id = p_campaign_id FOR UPDATE;

      -- Get wallet_id for ledger
      SELECT w.id INTO v_wallet_id
      FROM campaigns.campaigns c
      JOIN organizations.org_wallets w ON w.org_id = c.org_id
      WHERE c.id = p_campaign_id;

      -- Add fractional cost for THIS impression (CPM rate / 1000)
      UPDATE campaigns.campaigns
      SET spend_accrual = COALESCE(spend_accrual, 0) + (p_rate_credits / 1000.0)
      WHERE id = p_campaign_id
      RETURNING spend_accrual INTO v_acc;

      -- Convert whole credits to ledger
      v_whole := FLOOR(v_acc);
      IF v_whole >= 1 THEN
        -- Log whole credits to spend ledger (with all required fields)
        INSERT INTO campaigns.ad_spend_ledger (
          campaign_id,
          org_wallet_id,
          creative_id,
          metric_type,
          quantity,
          rate_model,
          rate_usd_cents,
          credits_charged,
          occurred_at
        )
        VALUES (
          p_campaign_id,
          v_wallet_id,
          p_creative_id,
          'impression',
          1,
          'cpm',
          FLOOR(p_rate_credits * 100)::INTEGER, -- Convert credits to cents
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

-- Verify it's working
SELECT 
  spent_credits,
  spend_accrual,
  (spent_credits + spend_accrual) AS total_with_accrual
FROM campaigns.campaigns 
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

