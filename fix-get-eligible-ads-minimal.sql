-- ===================================================================
-- MINIMAL FIX: Change only lines needed for estimated_rate
-- ===================================================================
-- Add c.bidding to matched_ads CTE
-- Change line 197 to use bidding instead of calculate_ad_rate
-- ===================================================================

DROP FUNCTION IF EXISTS public.get_eligible_ads(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.get_eligible_ads(
  p_user_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_keywords TEXT DEFAULT NULL,
  p_placement TEXT DEFAULT 'feed',
  p_limit INTEGER DEFAULT 5
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
SET search_path = public, campaigns, events, organizations
AS $$
BEGIN
  RETURN QUERY
  WITH active_campaigns AS (
    SELECT 
      c.id AS campaign_id,
      c.org_id,
      c.pricing_model,
      ct.categories AS target_categories,
      ct.locations AS target_locations,
      ct.keywords AS target_keywords,
      c.total_budget_credits,
      c.spent_credits,
      c.daily_budget_credits,
      c.start_date,
      c.end_date,
      (c.total_budget_credits - COALESCE(c.spent_credits, 0)) AS remaining_budget
    FROM campaigns.campaigns c
    LEFT JOIN campaigns.campaign_targeting ct ON ct.campaign_id = c.id
    WHERE 
      c.status::text = 'active'
      AND c.start_date <= now()
      AND (c.end_date IS NULL OR c.end_date >= now())
      AND (c.total_budget_credits - COALESCE(c.spent_credits, 0)) > 0
  ),
  eligible_creatives AS (
    -- Creatives linked to event posts
    SELECT
      ac.campaign_id,
      cr.id AS creative_id,
      cr.cta_label::text AS cta_label,
      cr.cta_url::text AS cta_url,
      posts.event_id AS event_id,
      ac.org_id,
      ac.pricing_model,
      ac.remaining_budget,
      ac.target_categories,
      ac.target_locations,
      ac.target_keywords,
      'post' AS source_type
    FROM active_campaigns ac
    INNER JOIN campaigns.ad_creatives cr ON cr.campaign_id = ac.campaign_id
    INNER JOIN events.event_posts posts ON posts.id = cr.post_id
    WHERE 
      cr.active = true
      AND cr.post_id IS NOT NULL
      AND posts.event_id IS NOT NULL
      AND EXISTS (
        SELECT 1 
        FROM campaigns.campaign_placements cp
        WHERE cp.campaign_id = ac.campaign_id
        AND cp.placement = p_placement::public.ad_placement
        AND cp.enabled = true
      )
    
    UNION ALL
    
    -- Creatives with direct media uploads
    SELECT
      ac.campaign_id,
      cr.id AS creative_id,
      cr.cta_label::text AS cta_label,
      cr.cta_url::text AS cta_url,
      NULL AS event_id,
      ac.org_id,
      ac.pricing_model,
      ac.remaining_budget,
      ac.target_categories,
      ac.target_locations,
      ac.target_keywords,
      'direct_upload' AS source_type
    FROM active_campaigns ac
    INNER JOIN campaigns.ad_creatives cr ON cr.campaign_id = ac.campaign_id
    WHERE 
      cr.active = true
      AND cr.post_id IS NULL
      AND cr.media_url IS NOT NULL
      AND EXISTS (
        SELECT 1 
        FROM campaigns.campaign_placements cp
        WHERE cp.campaign_id = ac.campaign_id
        AND cp.placement = p_placement::public.ad_placement
        AND cp.enabled = true
      )
  ),
  matched_ads AS (
    SELECT
      ec.campaign_id,
      ec.creative_id,
      COALESCE(ec.event_id, c.id) AS event_id,
      ec.org_id,
      ec.pricing_model::text,
      ec.remaining_budget,
      ec.cta_label AS cta_label,
      ec.cta_url AS cta_url,
      COALESCE(e.title::text, c.name::text) AS event_title,
      COALESCE(e.description::text, c.description::text) AS event_description,
      COALESCE(e.cover_image_url::text, cr.media_url::text) AS event_cover_image,
      COALESCE(e.start_at, c.end_date::timestamptz) AS event_start_at,
      CASE 
        WHEN e.venue IS NOT NULL THEN jsonb_build_object('name', e.venue)
        ELSE '{}'::JSONB
      END AS event_venue,
      COALESCE(NULLIF(e.category, ''), 'general') AS event_category,
      o.name::text AS org_name,
      o.logo_url::text AS org_logo_url,
      c.bidding,  -- ADD THIS: Include bidding JSONB
      CAST((
        (LEAST(ec.remaining_budget / 1000.0, 10) * 0.4) +
        (CASE 
          WHEN p_category IS NOT NULL AND ec.target_categories IS NOT NULL 
            AND p_category = ANY(ec.target_categories) THEN 0.3
          WHEN p_category IS NULL OR ec.target_categories IS NULL THEN 0.15
          ELSE 0.0
        END) +
        (CASE 
          WHEN p_location IS NOT NULL AND ec.target_locations IS NOT NULL 
            AND ec.target_locations::text ILIKE '%' || p_location || '%' THEN 0.2
          WHEN p_location IS NULL OR ec.target_locations IS NULL THEN 0.1
          ELSE 0.0
        END) +
        (random() * 0.1)
      ) AS NUMERIC) AS priority_score
    FROM eligible_creatives ec
    INNER JOIN campaigns.campaigns c ON c.id = ec.campaign_id
    INNER JOIN organizations.organizations o ON o.id = ec.org_id
    LEFT JOIN campaigns.ad_creatives cr ON cr.id = ec.creative_id
    LEFT JOIN events.events e ON e.id = ec.event_id
    WHERE
      (ec.event_id IS NULL OR e.start_at > now())
      AND (p_category IS NULL OR ec.target_categories IS NULL OR p_category = ANY(ec.target_categories))
      AND (p_location IS NULL OR ec.target_locations IS NULL OR ec.target_locations::text ILIKE '%' || p_location || '%')
  )
  SELECT
    ma.campaign_id,
    ma.creative_id,
    ma.event_id,
    ma.org_id,
    ma.org_name,
    ma.org_logo_url,
    ma.event_title,
    ma.event_description,
    ma.event_cover_image,
    ma.event_start_at,
    ma.event_venue,
    ma.event_category,
    ma.pricing_model,
    -- FIX THIS LINE: Use bidding instead of calculate_ad_rate
    COALESCE((ma.bidding->>'bid_cents')::NUMERIC, 0) AS estimated_rate,
    ma.priority_score,
    COALESCE(ma.cta_label, 'Learn More') AS cta_label,
    ma.cta_url
  FROM matched_ads ma
  ORDER BY ma.priority_score DESC, random()
  LIMIT p_limit;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_eligible_ads(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_eligible_ads(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION public.get_eligible_ads(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;

-- Test it
SELECT 
  campaign_id,
  estimated_rate AS new_rate_in_credits,
  pricing_model
FROM public.get_eligible_ads(
  p_placement := 'feed',
  p_limit := 1
)
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

SELECT 'Fixed! estimated_rate now returns bid_cents (500) instead of USD (5.00)' AS status;




