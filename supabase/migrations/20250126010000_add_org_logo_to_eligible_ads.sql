-- =====================================================
-- Add Organization Logo to get_eligible_ads Function
-- =====================================================
-- This migration updates the get_eligible_ads function
-- to return organization logo_url for professional display
-- of promoted content in the feed
-- =====================================================

-- Drop the existing function first since we're changing the return type
DROP FUNCTION IF EXISTS campaigns.get_eligible_ads(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION campaigns.get_eligible_ads(
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
  event_venue TEXT,
  event_category TEXT,
  pricing_model TEXT,
  estimated_rate DECIMAL,
  priority_score DECIMAL,
  cta_label TEXT,
  cta_url TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
      -- Calculate remaining budget
      (c.total_budget_credits - COALESCE(c.spent_credits, 0)) AS remaining_budget
    FROM campaigns.campaigns c
    LEFT JOIN campaigns.campaign_targeting ct ON ct.campaign_id = c.id
    WHERE 
      c.status::text = 'active'
      AND c.start_date <= now()
      AND (c.end_date IS NULL OR c.end_date >= now())
      -- Must have budget remaining
      AND (c.total_budget_credits - COALESCE(c.spent_credits, 0)) > 0
  ),
  eligible_creatives AS (
    SELECT
      ac.campaign_id,
      cr.id AS creative_id,
      cr.cta_label,
      cr.cta_url,
      posts.event_id AS event_id,
      ac.org_id,
      ac.pricing_model,
      ac.remaining_budget,
      ac.target_categories,
      ac.target_locations,
      ac.target_keywords
    FROM active_campaigns ac
    INNER JOIN campaigns.ad_creatives cr ON cr.campaign_id = ac.campaign_id
    INNER JOIN events.event_posts posts ON posts.id = cr.post_id
    WHERE 
      cr.active = true
      AND cr.post_id IS NOT NULL
      AND posts.event_id IS NOT NULL
      -- Check if placement is targeted
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
      ec.event_id,
      ec.org_id,
      ec.pricing_model,
      ec.remaining_budget,
      ec.cta_label,
      ec.cta_url,
      e.title AS event_title,
      e.description AS event_description,
      e.cover_image_url AS event_cover_image,
      e.start_at AS event_start_at,
      e.venue AS event_venue,
      e.category AS event_category,
      o.name AS org_name,
      o.logo_url AS org_logo_url,
      -- Calculate priority score
      (
        -- Budget weight (40%): More budget = higher priority
        (LEAST(ec.remaining_budget / 1000.0, 10) * 0.4) +
        -- Category match (30%): Exact match boosts priority
        (CASE 
          WHEN p_category IS NOT NULL AND ec.target_categories IS NOT NULL 
            AND p_category = ANY(ec.target_categories) THEN 0.3
          WHEN p_category IS NULL OR ec.target_categories IS NULL THEN 0.15
          ELSE 0.0
        END) +
        -- Location match (20%): Exact match boosts priority
        (CASE 
          WHEN p_location IS NOT NULL AND ec.target_locations IS NOT NULL 
            AND ec.target_locations::text ILIKE '%' || p_location || '%' THEN 0.2
          WHEN p_location IS NULL OR ec.target_locations IS NULL THEN 0.1
          ELSE 0.0
        END) +
        -- Randomness (10%): Prevent same ads always winning
        (random() * 0.1)
      ) AS priority_score
    FROM eligible_creatives ec
    INNER JOIN events.events e ON e.id = ec.event_id
    INNER JOIN organizations.organizations o ON o.id = ec.org_id
    WHERE
      -- Event ID must exist (from join with event_posts)
      ec.event_id IS NOT NULL
      -- Event must be in the future
      AND e.start_at > now()
      -- Apply category filter if provided
      AND (p_category IS NULL OR ec.target_categories IS NULL OR p_category = ANY(ec.target_categories))
      -- Apply location filter if provided (locations is JSONB, so we use text search)
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
    campaigns.calculate_ad_rate(ma.event_category, ma.pricing_model) AS estimated_rate,
    ma.priority_score,
    ma.cta_label,
    ma.cta_url
  FROM matched_ads ma
  ORDER BY ma.priority_score DESC, random()
  LIMIT p_limit;
END;
$$;

ALTER FUNCTION campaigns.get_eligible_ads(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) OWNER TO postgres;

COMMENT ON FUNCTION campaigns.get_eligible_ads IS 'Select eligible ads for serving with organization branding and CTA data';

GRANT EXECUTE ON FUNCTION campaigns.get_eligible_ads(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION campaigns.get_eligible_ads(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION campaigns.get_eligible_ads(UUID, TEXT, TEXT, TEXT, TEXT, INTEGER) TO service_role;

