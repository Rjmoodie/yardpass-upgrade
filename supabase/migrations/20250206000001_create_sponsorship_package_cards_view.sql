-- ============================================================================
-- Create v_sponsorship_package_cards View for Sponsor Marketplace
-- ============================================================================
-- This view provides a denormalized view of sponsorship packages with
-- event details and performance metrics for the sponsor marketplace.
-- ============================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.v_sponsorship_package_cards CASCADE;

-- Create the view
-- Note: We'll create a simplified version that doesn't depend on views that might not exist
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
  -- Event details
  e.id AS event_id_check,
  e.title AS event_title,
  e.start_at,
  e.end_at,
  e.category,
  e.city,
  e.cover_image_url,
  -- Computed fields with defaults (no dependency on complex views)
  0::bigint AS total_views,
  0::bigint AS avg_dwell_ms,
  0::integer AS tickets_sold,
  0::numeric AS conversion_rate,
  0::numeric AS engagement_score,
  0::integer AS social_mentions,
  0::numeric AS sentiment_score,
  -- Package metadata
  sp.expected_reach,
  sp.avg_engagement_score,
  sp.package_type,
  sp.quality_score,
  sp.quality_updated_at
FROM sponsorship.sponsorship_packages sp
INNER JOIN events.events e ON e.id = sp.event_id
WHERE sp.is_active = true
  AND sp.visibility = 'public';

-- Grant permissions
GRANT SELECT ON public.v_sponsorship_package_cards TO authenticated, anon;

-- Add helpful comment
COMMENT ON VIEW public.v_sponsorship_package_cards IS 'Denormalized view of active public sponsorship packages with event details for marketplace browsing';

-- Create index on underlying table for better performance
CREATE INDEX IF NOT EXISTS idx_sponsorship_packages_marketplace
  ON sponsorship.sponsorship_packages(is_active, visibility, event_id)
  WHERE is_active = true AND visibility = 'public';

