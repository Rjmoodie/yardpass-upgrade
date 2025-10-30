-- ===================================================================
-- FIX: Update get_eligible_ads to Return Bid in Credits
-- ===================================================================
-- Instead of using calculate_ad_rate (which returns USD),
-- use the actual bid from campaigns.bidding (which is in credits)
-- ===================================================================

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
  event_venue JSONB,
  event_category TEXT,
  pricing_model TEXT,
  estimated_rate NUMERIC,  -- NOW IN CREDITS, NOT USD
  priority_score NUMERIC,
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
      c.bidding,  -- Include bidding JSONB
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
    LEFT JOIN campaigns.campaign_targeting ct ON c.id = ct.campaign_id
    WHERE c.status = 'active'
      AND c.start_date <= CURRENT_DATE
      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
      AND (c.total_budget_credits - COALESCE(c.spent_credits, 0)) > 0
  ),
  matched_ads AS (
    SELECT DISTINCT ON (ac.campaign_id, cr.id)
      ac.campaign_id,
      cr.id AS creative_id,
      e.id AS event_id,
      ac.org_id,
      o.name AS org_name,
      o.logo_url AS org_logo_url,
      e.title AS event_title,
      e.description AS event_description,
      e.cover_image AS event_cover_image,
      e.start_at AS event_start_at,
      e.venue AS event_venue,
      e.category AS event_category,
      ac.pricing_model,
      ac.bidding,  -- Pass bidding through
      COALESCE(
        (SELECT 1 FROM campaigns.campaign_placements cp 
         WHERE cp.campaign_id = ac.campaign_id 
         AND cp.placement = p_placement 
         AND cp.enabled = true 
         LIMIT 1), 0
      )::NUMERIC * 100 AS priority_score,
      cr.cta_label,
      cr.cta_url
    FROM active_campaigns ac
    INNER JOIN campaigns.ad_creatives cr ON cr.campaign_id = ac.campaign_id AND cr.active = true
    INNER JOIN events.events e ON e.id = cr.event_id
    LEFT JOIN organizations.organizations o ON o.id = ac.org_id
    WHERE (p_category IS NULL OR e.category = p_category)
      AND (p_location IS NULL OR e.venue->>'city' = p_location)
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
    -- FIX: Return actual bid in CREDITS from bidding JSONB
    COALESCE((ma.bidding->>'bid_cents')::NUMERIC, 0) AS estimated_rate,
    ma.priority_score,
    COALESCE(ma.cta_label, 'Learn More') AS cta_label,
    ma.cta_url
  FROM matched_ads ma
  ORDER BY ma.priority_score DESC, random()
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION campaigns.get_eligible_ads IS 
'Select eligible ads for serving. Returns estimated_rate in CREDITS (e.g. 500 for $5 CPM), not USD.';

SELECT 'Fixed! get_eligible_ads now returns bid in credits instead of USD' AS status;


