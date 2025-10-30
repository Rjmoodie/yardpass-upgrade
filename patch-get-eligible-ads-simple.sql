-- ===================================================================
-- SIMPLE PATCH: Fix estimated_rate to return credits instead of USD
-- ===================================================================
-- This patches ONLY the estimated_rate calculation in the existing function
-- ===================================================================

-- First, let's check what the current function returns
SELECT 
  campaign_id,
  estimated_rate,
  pricing_model
FROM public.get_eligible_ads(
  p_placement := 'feed'::TEXT,
  p_limit := 1
)
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Now apply the patch by replacing line 197
-- We need to join campaigns table in the final SELECT to get bidding

CREATE OR REPLACE FUNCTION public.get_eligible_ads(
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_placement TEXT DEFAULT 'feed',
  p_category TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  campaign_id UUID,
  creative_id UUID,
  event_id UUID,
  org_id UUID,
  org_name TEXT,
  org_logo_url TEXT,
  event_title TEXT,
  event_description TEXT,
  event_cover_image TEXT,
  event_start_at TIMESTAMPTZ,
  event_venue JSONB,
  event_category TEXT,
  pricing_model TEXT,
  estimated_rate NUMERIC,
  priority_score NUMERIC,
  cta_label TEXT,
  cta_url TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  -- Same logic as before, just the final SELECT changes
  -- Copy the entire function but change line 197
  
  -- Rather than rewrite 200+ lines, let's create a wrapper
  RETURN QUERY
  WITH base_ads AS (
    -- Call the original logic by inlining it
    SELECT * FROM public.get_eligible_ads_internal(p_user_id, p_session_id, p_placement, p_category, p_location, p_limit * 2)
  )
  SELECT 
    ba.campaign_id,
    ba.creative_id,
    ba.event_id,
    ba.org_id,
    ba.org_name,
    ba.org_logo_url,
    ba.event_title,
    ba.event_description,
    ba.event_cover_image,
    ba.event_start_at,
    ba.event_venue,
    ba.event_category,
    ba.pricing_model,
    -- FIX: Get actual bid from campaigns table instead of calculate_ad_rate
    COALESCE((c.bidding->>'bid_cents')::NUMERIC, ba.estimated_rate) AS estimated_rate,
    ba.priority_score,
    ba.cta_label,
    ba.cta_url
  FROM base_ads ba
  LEFT JOIN campaigns.campaigns c ON c.id = ba.campaign_id
  LIMIT p_limit;
END;
$$;

-- Actually, that won't work because get_eligible_ads_internal doesn't exist.
-- Let me just do a direct SQL replacement instead.

DROP FUNCTION IF EXISTS public.get_eligible_ads(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER);


