-- ============================================================================
-- Add Analytics Showcase to Sponsorship Packages
-- ============================================================================
-- Allows organizers to select which analytics/metrics to display to sponsors
-- when they're browsing packages in the marketplace.
-- ============================================================================

-- Add analytics_showcase column to sponsorship_packages
ALTER TABLE sponsorship.sponsorship_packages
ADD COLUMN IF NOT EXISTS analytics_showcase jsonb DEFAULT '{"enabled": false, "metrics": []}'::jsonb;

-- Add reference_event_id for showing analytics from past events
ALTER TABLE sponsorship.sponsorship_packages
ADD COLUMN IF NOT EXISTS reference_event_id uuid REFERENCES events.events(id) ON DELETE SET NULL;

COMMENT ON COLUMN sponsorship.sponsorship_packages.analytics_showcase IS 
'JSONB configuration for which analytics to display to sponsors. Structure: {
  "enabled": boolean,
  "metrics": ["total_attendees", "engagement_rate", "social_reach", "demographics", etc.],
  "source": "current" | "reference",
  "custom_stats": [{"label": "Past Sponsor ROI", "value": "250%"}]
}';

COMMENT ON COLUMN sponsorship.sponsorship_packages.reference_event_id IS 
'Optional reference to a past event to pull analytics from (e.g., last year''s conference)';

-- Create a helper function to get event analytics
CREATE OR REPLACE FUNCTION public.get_event_analytics(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, events, ticketing, pg_catalog
AS $$
DECLARE
  result jsonb;
  total_tickets integer;
  total_revenue numeric;
  engagement_count integer;
BEGIN
  -- Get ticket sales
  SELECT COUNT(*), COALESCE(SUM(tt.price_cents), 0)
  INTO total_tickets, total_revenue
  FROM ticketing.tickets t
  JOIN ticketing.ticket_tiers tt ON t.tier_id = tt.id
  WHERE t.event_id = p_event_id
    AND t.status IN ('issued', 'transferred', 'redeemed');

  -- Get engagement (posts + comments + reactions)
  SELECT 
    COALESCE(COUNT(DISTINCT ep.id), 0) + 
    COALESCE(COUNT(DISTINCT ec.id), 0) + 
    COALESCE(COUNT(DISTINCT er.id), 0)
  INTO engagement_count
  FROM events.events e
  LEFT JOIN events.event_posts ep ON ep.event_id = e.id AND ep.deleted_at IS NULL
  LEFT JOIN events.event_comments ec ON ec.event_id = e.id
  LEFT JOIN events.event_reactions er ON er.event_id = e.id
  WHERE e.id = p_event_id;

  result := jsonb_build_object(
    'total_attendees', COALESCE(total_tickets, 0),
    'total_revenue', COALESCE(total_revenue / 100.0, 0),
    'engagement_count', COALESCE(engagement_count, 0),
    'calculated_at', now()
  );

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_event_analytics IS 
'Calculates basic analytics for an event (attendees, revenue, engagement)';

GRANT EXECUTE ON FUNCTION public.get_event_analytics TO authenticated, anon;

-- Update the v_sponsorship_package_cards view to include analytics
DROP VIEW IF EXISTS public.v_sponsorship_package_cards CASCADE;

CREATE OR REPLACE VIEW public.v_sponsorship_package_cards AS
SELECT
  sp.id,
  sp.event_id,
  sp.tier,
  sp.price_cents,
  sp.title,
  sp.description,
  sp.benefits,
  sp.inventory,
  sp.sold,
  sp.is_active,
  sp.visibility,
  sp.created_at,
  sp.analytics_showcase,
  sp.reference_event_id,
  -- Event details
  e.id AS event_id_check,
  e.title AS event_title,
  e.start_at,
  e.end_at,
  e.category,
  e.city,
  e.cover_image_url,
  -- Reference event details (if using past event for analytics)
  ref_e.title AS reference_event_title,
  ref_e.start_at AS reference_event_start_at,
  -- Package metadata
  sp.expected_reach,
  sp.avg_engagement_score,
  sp.package_type,
  sp.quality_score,
  sp.quality_updated_at,
  -- Analytics from current event (if available)
  CASE 
    WHEN e.start_at < now() THEN public.get_event_analytics(e.id)
    ELSE NULL
  END AS current_event_analytics,
  -- Analytics from reference event (if specified)
  CASE 
    WHEN sp.reference_event_id IS NOT NULL THEN public.get_event_analytics(sp.reference_event_id)
    ELSE NULL
  END AS reference_event_analytics
FROM sponsorship.sponsorship_packages sp
INNER JOIN events.events e ON e.id = sp.event_id
LEFT JOIN events.events ref_e ON ref_e.id = sp.reference_event_id
WHERE sp.is_active = true
  AND sp.visibility = 'public';

GRANT SELECT ON public.v_sponsorship_package_cards TO authenticated, anon;

COMMENT ON VIEW public.v_sponsorship_package_cards IS 
'Denormalized view of active public sponsorship packages with event details and analytics for marketplace browsing. Includes analytics from both current and reference events.';

