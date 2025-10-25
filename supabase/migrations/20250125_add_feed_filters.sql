-- Migration: Add server-side filtering to feed ranking system
-- This enables category, location, and date filtering at the SQL level for better performance

-- Drop the old wrapper function first
DROP FUNCTION IF EXISTS public.get_home_feed_ranked(uuid, integer, uuid);

-- Drop the old function to replace it
DROP FUNCTION IF EXISTS public.get_home_feed_ids(uuid, integer, uuid);

-- Create enhanced ranking function with filter support
CREATE OR REPLACE FUNCTION public.get_home_feed_ids(
  p_user uuid,
  p_limit integer DEFAULT 80,
  p_cursor_item_id uuid DEFAULT NULL,
  -- NEW: Filter parameters
  p_categories text[] DEFAULT NULL,
  p_user_lat double precision DEFAULT NULL,
  p_user_lng double precision DEFAULT NULL,
  p_max_distance_miles double precision DEFAULT NULL,
  p_date_filters text[] DEFAULT NULL
)
RETURNS TABLE(
  item_type text,
  item_id uuid,
  event_id uuid,
  score numeric,
  sort_ts timestamptz
)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
WITH
-- Helper function to calculate distance in miles using haversine formula
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
  FROM events e
  WHERE p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL
),
-- Helper to check date filters
date_filter_check AS (
  SELECT 
    e.id AS event_id,
    e.start_at,
    -- Check if event matches any of the date filters
    CASE
      WHEN p_date_filters IS NULL OR array_length(p_date_filters, 1) IS NULL THEN true
      WHEN 'Tonight' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('day', now()) 
        AND e.start_at < date_trunc('day', now() + interval '1 day')
      ) THEN true
      WHEN 'This Weekend' = ANY(p_date_filters) AND (
        -- Friday 6PM to Sunday 11:59PM
        e.start_at >= date_trunc('week', now()) + interval '4 days' + interval '18 hours'
        AND e.start_at < date_trunc('week', now()) + interval '7 days'
      ) THEN true
      WHEN 'This Week' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('week', now())
        AND e.start_at < date_trunc('week', now()) + interval '7 days'
      ) THEN true
      WHEN 'Next Week' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('week', now()) + interval '7 days'
        AND e.start_at < date_trunc('week', now()) + interval '14 days'
      ) THEN true
      WHEN 'This Month' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('month', now())
        AND e.start_at < date_trunc('month', now()) + interval '1 month'
      ) THEN true
      WHEN 'Next Month' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('month', now()) + interval '1 month'
        AND e.start_at < date_trunc('month', now()) + interval '2 months'
      ) THEN true
      ELSE false
    END AS passes_date_filter
  FROM events e
),
candidate_events AS (
  SELECT
    e.id AS event_id,
    COALESCE(e.start_at, e.created_at, now()) AS anchor_ts,
    GREATEST(
      0,
      1.0 - ABS(EXTRACT(EPOCH FROM (now() - COALESCE(e.start_at, e.created_at, now()))) / 86400.0) / 180.0
    ) AS freshness,
    dc.distance_miles
  FROM events e
  LEFT JOIN distance_calc dc ON dc.event_id = e.id
  LEFT JOIN date_filter_check dfc ON dfc.event_id = e.id
  WHERE e.visibility = 'public'
    AND (
      COALESCE(e.start_at, e.created_at, now()) > now() - INTERVAL '365 days'
      OR EXISTS (
        SELECT 1
        FROM event_posts ep
        WHERE ep.event_id = e.id
          AND ep.deleted_at IS NULL
      )
    )
    -- NEW: Apply category filter
    AND (
      p_categories IS NULL 
      OR array_length(p_categories, 1) IS NULL 
      OR e.category = ANY(p_categories)
    )
    -- NEW: Apply distance filter
    AND (
      p_max_distance_miles IS NULL
      OR dc.distance_miles IS NULL
      OR dc.distance_miles <= p_max_distance_miles
    )
    -- NEW: Apply date filter
    AND (
      p_date_filters IS NULL
      OR array_length(p_date_filters, 1) IS NULL
      OR dfc.passes_date_filter = true
    )
),
engagement AS (
  SELECT
    p.event_id,
    COALESCE(SUM(p.like_count), 0) * 1.0
      + COALESCE(SUM(p.comment_count), 0) * 1.5 AS engagement
  FROM event_posts p
  WHERE p.deleted_at IS NULL
  GROUP BY 1
),
affinity AS (
  SELECT e.id AS event_id,
         COALESCE(follow_evt.weight, 0)
       + COALESCE(follow_org.weight, 0)
       + COALESCE(ticket_affinity.weight, 0)
       + COALESCE(location_boost.weight, 0) AS affinity  -- NEW: location boost
  FROM events e
  LEFT JOIN LATERAL (
    SELECT 1.0 AS weight
    FROM follows ef
    WHERE ef.follower_user_id = p_user
      AND ef.target_type = 'event'
      AND ef.target_id = e.id
    LIMIT 1
  ) follow_evt ON TRUE
  LEFT JOIN LATERAL (
    SELECT 0.8 AS weight
    FROM follows ofo
    WHERE ofo.follower_user_id = p_user
      AND ofo.target_type = 'organizer'
      AND ofo.target_id = e.created_by
    LIMIT 1
  ) follow_org ON TRUE
  LEFT JOIN LATERAL (
    SELECT 1.2 AS weight
    FROM tickets t
    WHERE t.owner_user_id = p_user
      AND t.event_id = e.id
      AND t.status IN ('issued', 'transferred', 'redeemed')
    LIMIT 1
  ) ticket_affinity ON TRUE
  -- NEW: Boost events that are closer to user (within 10 miles = +0.5 affinity)
  LEFT JOIN LATERAL (
    SELECT 
      CASE 
        WHEN dc.distance_miles IS NOT NULL AND dc.distance_miles <= 10 THEN 0.5
        WHEN dc.distance_miles IS NOT NULL AND dc.distance_miles <= 25 THEN 0.3
        ELSE 0
      END AS weight
    FROM distance_calc dc
    WHERE dc.event_id = e.id
    LIMIT 1
  ) location_boost ON TRUE
),
z AS (
  SELECT
    ce.event_id,
    ce.freshness,
    COALESCE(e.engagement, 0) AS engagement,
    COALESCE(a.affinity,   0) AS affinity
  FROM candidate_events ce
  LEFT JOIN engagement e ON e.event_id = ce.event_id
  LEFT JOIN affinity   a ON a.event_id = ce.event_id
),
stats AS (
  SELECT
    GREATEST(COALESCE(MAX(freshness),  0.001), 0.001) AS max_fresh,
    GREATEST(COALESCE(MAX(engagement), 0.001), 0.001) AS max_eng,
    GREATEST(COALESCE(MAX(affinity),   0.001), 0.001) AS max_aff
  FROM z
),
scored_events AS (
  SELECT
    z.event_id,
    (0.60 * (COALESCE(z.freshness, 0)  / GREATEST(s.max_fresh, 0.001))) +
    (0.25 * (COALESCE(z.engagement, 0) / GREATEST(s.max_eng, 0.001))) +
    (0.15 * (COALESCE(z.affinity, 0)   / GREATEST(s.max_aff, 0.001))) AS base_score
  FROM z, stats s
),
all_posts AS (
  SELECT
    p.event_id,
    p.id AS post_id,
    p.created_at,
    (COALESCE(p.like_count,0) + 1.2 * COALESCE(p.comment_count,0)) AS engagement_score
  FROM event_posts p
  JOIN candidate_events ce ON ce.event_id = p.event_id
  WHERE p.deleted_at IS NULL
    AND p.created_at > now() - INTERVAL '365 days'
),
ranked_posts AS (
  SELECT
    ap.*,
    ROW_NUMBER() OVER (
      PARTITION BY ap.event_id
      ORDER BY ap.created_at DESC, ap.engagement_score DESC, ap.post_id DESC
    ) AS rn
  FROM all_posts ap
),
event_order AS (
  SELECT
    e.event_id,
    e.base_score,
    ce.anchor_ts,
    ev.start_at,
    ROW_NUMBER() OVER (
      ORDER BY e.base_score DESC, ce.anchor_ts DESC NULLS LAST, e.event_id DESC
    ) AS event_rank
  FROM scored_events e
  JOIN candidate_events ce ON ce.event_id = e.event_id
  JOIN events ev ON ev.id = e.event_id
),
items AS (
  SELECT
    'event'::text AS item_type,
    eo.event_id::uuid AS item_id,
    eo.event_id,
    eo.base_score AS score,
    COALESCE(eo.anchor_ts, eo.start_at) AS sort_ts,
    eo.event_rank,
    0 AS within_event_rank
  FROM event_order eo

  UNION ALL

  SELECT
    'post'::text AS item_type,
    rp.post_id AS item_id,
    rp.event_id,
    eo.base_score * 0.98 AS score,
    rp.created_at AS sort_ts,
    eo.event_rank,
    rp.rn AS within_event_rank
  FROM ranked_posts rp
  JOIN event_order eo ON eo.event_id = rp.event_id
  WHERE rp.rn <= 3
),
ordered AS (
  SELECT
    i.item_type,
    i.item_id,
    i.event_id,
    i.score,
    COALESCE(i.sort_ts, now()) AS sort_ts,
    i.event_rank,
    i.within_event_rank,
    ROW_NUMBER() OVER (
      ORDER BY i.event_rank, i.within_event_rank, COALESCE(i.sort_ts, now()) DESC, i.item_id DESC
    ) AS rn
  FROM items i
),
cursor_position AS (
  SELECT rn
  FROM ordered
  WHERE p_cursor_item_id IS NOT NULL
    AND item_id = p_cursor_item_id
)
SELECT
  item_type,
  item_id,
  event_id,
  score,
  sort_ts
FROM ordered
WHERE (SELECT rn FROM cursor_position) IS NULL
   OR ordered.rn > (SELECT rn FROM cursor_position)
ORDER BY rn
LIMIT p_limit;
$$;

-- Re-create the wrapper function with new signature
CREATE OR REPLACE FUNCTION public.get_home_feed_ranked(
  p_user_id uuid,
  p_limit integer DEFAULT 80,
  p_cursor_item_id uuid DEFAULT NULL,
  p_categories text[] DEFAULT NULL,
  p_user_lat double precision DEFAULT NULL,
  p_user_lng double precision DEFAULT NULL,
  p_max_distance_miles double precision DEFAULT NULL,
  p_date_filters text[] DEFAULT NULL
)
RETURNS TABLE(
  item_type text,
  item_id uuid,
  event_id uuid,
  score numeric,
  sort_ts timestamptz
)
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT *
  FROM public.get_home_feed_ids(
    p_user_id,
    p_limit,
    p_cursor_item_id,
    p_categories,
    p_user_lat,
    p_user_lng,
    p_max_distance_miles,
    p_date_filters
  );
$$;

-- Grant permissions
GRANT ALL ON FUNCTION public.get_home_feed_ids(uuid, integer, uuid, text[], double precision, double precision, double precision, text[]) TO anon;
GRANT ALL ON FUNCTION public.get_home_feed_ids(uuid, integer, uuid, text[], double precision, double precision, double precision, text[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_home_feed_ids(uuid, integer, uuid, text[], double precision, double precision, double precision, text[]) TO service_role;

GRANT ALL ON FUNCTION public.get_home_feed_ranked(uuid, integer, uuid, text[], double precision, double precision, double precision, text[]) TO anon;
GRANT ALL ON FUNCTION public.get_home_feed_ranked(uuid, integer, uuid, text[], double precision, double precision, double precision, text[]) TO authenticated;
GRANT ALL ON FUNCTION public.get_home_feed_ranked(uuid, integer, uuid, text[], double precision, double precision, double precision, text[]) TO service_role;

-- Add comment documenting the new functionality
COMMENT ON FUNCTION public.get_home_feed_ranked IS 'Ranked feed with server-side filtering: categories, location distance ("Near Me"), and date ranges. Maintains 60% freshness, 25% engagement, 15% affinity scoring.';

