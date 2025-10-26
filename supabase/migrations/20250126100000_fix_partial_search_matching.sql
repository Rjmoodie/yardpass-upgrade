-- Fix search to support partial word matching
-- Changes plainto_tsquery to use prefix matching (:*) for better UX

CREATE OR REPLACE FUNCTION public.search_events_ranked(
  p_search_text text,
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_categories text[] DEFAULT NULL,
  p_user_lat double precision DEFAULT NULL,
  p_user_lng double precision DEFAULT NULL,
  p_max_distance_miles double precision DEFAULT NULL,
  p_date_filters text[] DEFAULT NULL,
  p_price_range text DEFAULT NULL
)
RETURNS TABLE(
  event_id uuid,
  title text,
  description text,
  start_at timestamptz,
  venue text,
  address text,
  city text,
  cover_image_url text,
  category text,
  owner_context_type public.owner_context,
  owner_context_id uuid,
  organizer_name text,
  min_price_cents integer,
  search_rank real,
  engagement_score numeric,
  distance_miles double precision
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'events'
AS $$
WITH
-- Parse search query into tsquery with prefix matching
search_query AS (
  SELECT 
    CASE 
      WHEN p_search_text IS NULL OR trim(p_search_text) = '' THEN NULL
      ELSE (
        -- Split into words and add :* prefix matching to each word
        to_tsquery('english', 
          regexp_replace(
            trim(regexp_replace(p_search_text, E'[^a-zA-Z0-9\\s]', ' ', 'g')),
            E'\\s+',
            ':* & ',
            'g'
          ) || ':*'
        )
      )
    END AS query
),
-- Calculate distance for location-based filtering
distance_calc AS (
  SELECT
    e.id AS event_id,
    CASE 
      WHEN e.lat IS NULL OR e.lng IS NULL OR p_user_lat IS NULL OR p_user_lng IS NULL THEN NULL
      ELSE (
        3959 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(p_user_lat)) 
            * cos(radians(e.lat)) 
            * cos(radians(e.lng) - radians(p_user_lng)) 
            + sin(radians(p_user_lat)) 
            * sin(radians(e.lat))
          ))
        )
      )
    END AS distance_miles
  FROM events.events e
  WHERE p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL
),
-- Check date filters
date_filter_check AS (
  SELECT
    e.id AS event_id,
    CASE
      WHEN p_date_filters IS NULL OR array_length(p_date_filters, 1) IS NULL THEN true
      WHEN 'today' = ANY(p_date_filters) AND date_trunc('day', e.start_at) = date_trunc('day', now() AT TIME ZONE COALESCE(e.timezone, 'UTC')) THEN true
      WHEN 'tomorrow' = ANY(p_date_filters) AND date_trunc('day', e.start_at) = date_trunc('day', (now() + interval '1 day') AT TIME ZONE COALESCE(e.timezone, 'UTC')) THEN true
      WHEN 'this-week' = ANY(p_date_filters) AND date_trunc('week', e.start_at) = date_trunc('week', now() AT TIME ZONE COALESCE(e.timezone, 'UTC')) THEN true
      WHEN 'next-week' = ANY(p_date_filters) AND date_trunc('week', e.start_at) = date_trunc('week', (now() + interval '1 week') AT TIME ZONE COALESCE(e.timezone, 'UTC')) THEN true
      WHEN 'this-month' = ANY(p_date_filters) AND date_trunc('month', e.start_at) = date_trunc('month', now() AT TIME ZONE COALESCE(e.timezone, 'UTC')) THEN true
      WHEN 'this-weekend' = ANY(p_date_filters) AND 
        EXTRACT(DOW FROM e.start_at AT TIME ZONE COALESCE(e.timezone, 'UTC')) IN (0, 6) AND
        date_trunc('week', e.start_at) = date_trunc('week', now() AT TIME ZONE COALESCE(e.timezone, 'UTC')) THEN true
      ELSE false
    END AS passes_date_filter
  FROM events.events e
),
-- Pre-aggregate engagement metrics
event_engagement AS (
  SELECT
    event_id,
    COUNT(DISTINCT author_user_id) AS engagement
  FROM events.event_posts
  WHERE created_at >= now() - interval '30 days'
  GROUP BY event_id
),
-- Pre-aggregate pricing
event_pricing AS (
  SELECT
    event_id,
    MIN(price_cents) AS min_price_cents
  FROM ticketing.ticket_tiers
  GROUP BY event_id
),
-- Main event query with all filters
filtered_events AS (
  SELECT
    e.id,
    e.title,
    e.description,
    e.start_at,
    e.venue,
    e.address,
    e.city,
    e.cover_image_url,
    e.category,
    e.owner_context_type,
    e.owner_context_id,
    e.search_vector,
    dc.distance_miles,
    ee.engagement,
    ep.min_price_cents,
    -- Full-text search ranking (0.0 to 1.0)
    CASE 
      WHEN sq.query IS NOT NULL THEN ts_rank(e.search_vector, sq.query)
      ELSE 0.5  -- neutral rank when no search text
    END AS text_relevance,
    -- Freshness score (upcoming events score higher)
    GREATEST(0, 1.0 - (EXTRACT(EPOCH FROM (e.start_at - now())) / 86400.0) / 365.0) AS freshness,
    -- Organizer name
    CASE 
      WHEN e.owner_context_type = 'organization' THEN o.name
      ELSE up.display_name
    END AS organizer_name
  FROM events.events e
  CROSS JOIN search_query sq
  LEFT JOIN distance_calc dc ON dc.event_id = e.id
  LEFT JOIN date_filter_check dfc ON dfc.event_id = e.id
  LEFT JOIN event_engagement ee ON ee.event_id = e.id
  LEFT JOIN event_pricing ep ON ep.event_id = e.id
  LEFT JOIN organizations.organizations o ON e.owner_context_type = 'organization' AND e.owner_context_id = o.id
  LEFT JOIN public.user_profiles up ON e.owner_context_type = 'individual' AND e.created_by = up.user_id
  WHERE e.visibility = 'public'
    AND e.start_at >= now()  -- Only future events
    -- Full-text search filter (now supports prefix matching)
    AND (
      sq.query IS NULL 
      OR e.search_vector @@ sq.query
    )
    -- Category filter
    AND (
      p_categories IS NULL 
      OR array_length(p_categories, 1) IS NULL 
      OR e.category = ANY(p_categories)
    )
    -- Distance filter
    AND (
      p_max_distance_miles IS NULL
      OR dc.distance_miles IS NULL
      OR dc.distance_miles <= p_max_distance_miles
    )
    -- Date filter
    AND (
      p_date_filters IS NULL
      OR array_length(p_date_filters, 1) IS NULL
      OR dfc.passes_date_filter = true
    )
    -- Price filter
    AND (
      p_price_range IS NULL
      OR p_price_range = 'all'
      OR (p_price_range = 'free' AND (ep.min_price_cents IS NULL OR ep.min_price_cents = 0))
      OR (p_price_range = 'under-50' AND ep.min_price_cents < 5000)
      OR (p_price_range = 'over-50' AND ep.min_price_cents >= 5000)
    )
),
-- Calculate final ranking score
ranked_results AS (
  SELECT
    fe.*,
    -- Weighted scoring:
    -- 40% text relevance (how well it matches search)
    -- 30% freshness (upcoming events)
    -- 20% engagement (popular events)
    -- 10% proximity (nearby events)
    (
      0.40 * COALESCE(fe.text_relevance, 0) +
      0.30 * COALESCE(fe.freshness, 0) +
      0.20 * (COALESCE(fe.engagement, 0) / NULLIF(GREATEST((SELECT MAX(engagement) FROM filtered_events), 0.001), 0)) +
      0.10 * CASE 
        WHEN fe.distance_miles IS NOT NULL THEN (1.0 - LEAST(fe.distance_miles / 100.0, 1.0))
        ELSE 0.5
      END
    ) AS final_rank
  FROM filtered_events fe
)
SELECT
  rr.id AS event_id,
  rr.title,
  rr.description,
  rr.start_at,
  rr.venue,
  rr.address,
  rr.city,
  rr.cover_image_url,
  rr.category,
  rr.owner_context_type,
  rr.owner_context_id,
  rr.organizer_name,
  rr.min_price_cents,
  rr.text_relevance AS search_rank,
  rr.engagement AS engagement_score,
  rr.distance_miles
FROM ranked_results rr
ORDER BY 
  rr.final_rank DESC,
  rr.start_at ASC
LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.search_events_ranked IS 'Full-text search with prefix matching and ranking: 40% relevance, 30% freshness, 20% engagement, 10% proximity. Supports partial word matching (e.g., "spli" matches "splish"), stemming, and all feed filters.';

