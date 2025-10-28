-- =====================================================
-- CONVERSION TRACKING ENHANCEMENTS
-- =====================================================
-- Adds industry-standard fields for conversion attribution,
-- analytics, and multi-channel tracking
-- =====================================================

-- 1. Add new columns to ad_conversions
ALTER TABLE campaigns.ad_conversions
  ADD COLUMN IF NOT EXISTS conversion_source TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT,
  ADD COLUMN IF NOT EXISTS attribution_model TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS referrer TEXT;

-- 2. Drop old attribute_conversion function (if exists)
DROP FUNCTION IF EXISTS public.attribute_conversion CASCADE;

-- 3. Create enhanced attribute_conversion with new parameters
CREATE OR REPLACE FUNCTION public.attribute_conversion(
  p_user_id UUID,
  p_session_id TEXT,
  p_kind TEXT DEFAULT 'purchase',
  p_value_cents INTEGER DEFAULT 0,
  p_ticket_id UUID DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW(),
  p_request_id UUID DEFAULT NULL,
  p_conversion_source TEXT DEFAULT NULL,
  p_device_type TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_referrer TEXT DEFAULT NULL
)
RETURNS TABLE (
  conversion_id UUID,
  click_id UUID,
  impression_id UUID,
  attribution_model TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversion_id UUID;
  v_click_id UUID;
  v_impression_id UUID;
  v_attribution TEXT;
BEGIN
  -- Last-click attribution (7 days)
  SELECT c.id, i.id INTO v_click_id, v_impression_id
  FROM campaigns.ad_clicks c
  LEFT JOIN campaigns.ad_impressions i ON i.id = c.impression_id
  WHERE (c.user_id = p_user_id OR c.session_id = p_session_id)
    AND c.created_at >= p_occurred_at - INTERVAL '7 days'
    AND c.created_at <= p_occurred_at
  ORDER BY c.created_at DESC 
  LIMIT 1;

  IF v_click_id IS NOT NULL THEN
    v_attribution := 'last_click_7d';
  ELSE
    -- View-through attribution (1 day)
    SELECT i.id INTO v_impression_id
    FROM campaigns.ad_impressions i
    WHERE (i.user_id = p_user_id OR i.session_id = p_session_id)
      AND i.created_at >= p_occurred_at - INTERVAL '1 day'
      AND i.created_at <= p_occurred_at
      AND i.viewable = true  -- Only count viewable impressions
    ORDER BY i.created_at DESC
    LIMIT 1;
    
    IF v_impression_id IS NOT NULL THEN
      v_attribution := 'view_through_1d';
    ELSE
      v_attribution := 'none';
    END IF;
  END IF;

  -- Insert conversion record (if attribution found)
  IF v_click_id IS NOT NULL OR v_impression_id IS NOT NULL THEN
    INSERT INTO campaigns.ad_conversions (
      id, click_id, impression_id, user_id, session_id,
      kind, value_cents, ticket_id, occurred_at, request_id,
      attribution_model, conversion_source, device_type, user_agent, referrer
    )
    VALUES (
      gen_random_uuid(), v_click_id, v_impression_id, p_user_id, p_session_id,
      p_kind, p_value_cents, p_ticket_id, p_occurred_at, p_request_id,
      v_attribution, p_conversion_source, p_device_type, p_user_agent, p_referrer
    )
    ON CONFLICT (request_id) WHERE request_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_conversion_id;
  END IF;

  RETURN QUERY SELECT v_conversion_id, v_click_id, v_impression_id, v_attribution;
END $$;

COMMENT ON FUNCTION public.attribute_conversion IS 
  'Attributes conversion to last click (7d) or view-through impression (1d). Returns attribution model used. Enhanced with source tracking.';

-- 4. Create helper function for simple ticket purchase conversions
CREATE OR REPLACE FUNCTION public.track_ticket_conversion(
  p_user_id UUID,
  p_session_id TEXT,
  p_ticket_id UUID,
  p_ticket_price_cents INTEGER,
  p_conversion_source TEXT DEFAULT 'checkout'
)
RETURNS TABLE (
  success BOOLEAN,
  conversion_id UUID,
  attribution_model TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Call attribute_conversion
  SELECT * INTO v_result
  FROM public.attribute_conversion(
    p_user_id := p_user_id,
    p_session_id := p_session_id,
    p_kind := 'purchase',
    p_value_cents := p_ticket_price_cents,
    p_ticket_id := p_ticket_id,
    p_occurred_at := NOW(),
    p_request_id := gen_random_uuid(),
    p_conversion_source := p_conversion_source,
    p_device_type := NULL,
    p_user_agent := NULL,
    p_referrer := NULL
  );

  RETURN QUERY SELECT 
    (v_result.conversion_id IS NOT NULL)::BOOLEAN,
    v_result.conversion_id,
    v_result.attribution_model;
END $$;

COMMENT ON FUNCTION public.track_ticket_conversion IS 
  'Simplified helper for tracking ticket purchase conversions. Call this after successful checkout.';

-- 5. Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_ad_conversions_source
ON campaigns.ad_conversions (conversion_source)
WHERE conversion_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ad_conversions_attribution_model
ON campaigns.ad_conversions (attribution_model)
WHERE attribution_model IS NOT NULL;

-- 6. Grant permissions
GRANT EXECUTE ON FUNCTION public.track_ticket_conversion TO authenticated, service_role;

-- 7. Add comments
COMMENT ON COLUMN campaigns.ad_conversions.conversion_source IS 'Origin surface: feed, explore, event_detail, checkout, etc.';
COMMENT ON COLUMN campaigns.ad_conversions.device_type IS 'Device category: mobile, tablet, desktop';
COMMENT ON COLUMN campaigns.ad_conversions.attribution_model IS 'Attribution used: last_click_7d, view_through_1d, none';
COMMENT ON COLUMN campaigns.ad_conversions.user_agent IS 'User agent string for fraud detection';
COMMENT ON COLUMN campaigns.ad_conversions.referrer IS 'HTTP referrer for cross-domain tracking';

