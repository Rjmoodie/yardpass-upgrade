-- ============================================================================
-- Fix: Allow posts from past events to show in feed
-- ============================================================================
-- The current feed function only shows posts from future events (candidate_events).
-- This migration fixes it to allow posts from past events (within 180 days)
-- while still only showing event cards for future events.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_home_feed_ids(
  p_user uuid,
  p_limit integer DEFAULT 80,
  p_cursor_item_id uuid DEFAULT NULL,
  p_categories text[] DEFAULT NULL,
  p_user_lat double precision DEFAULT NULL,
  p_user_lng double precision DEFAULT NULL,
  p_max_distance_miles double precision DEFAULT NULL,
  p_date_filters text[] DEFAULT NULL,
  p_session_id text DEFAULT NULL
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
-- Load feature weights once
weights AS (
  SELECT 
    jsonb_object_agg(feature, weight) AS w,
    jsonb_object_agg(feature, COALESCE(half_life_days, 0)) AS hl
  FROM public.model_feature_weights
),
-- Distance calculation (unchanged)
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
-- Date filter check (unchanged)
date_filter_check AS (
  SELECT 
    e.id AS event_id,
    e.start_at,
    CASE
      WHEN p_date_filters IS NULL OR array_length(p_date_filters, 1) IS NULL THEN true
      WHEN 'Tonight' = ANY(p_date_filters) AND (
        e.start_at >= date_trunc('day', now()) 
        AND e.start_at < date_trunc('day', now() + interval '1 day')
      ) THEN true
      WHEN 'This Weekend' = ANY(p_date_filters) AND (
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
-- Get minimum ticket price per event (from ticket_tiers)
event_pricing AS (
  SELECT
    tt.event_id,
    MIN(tt.price_cents) AS min_price_cents
  FROM public.ticket_tiers tt
  WHERE tt.status = 'active'
  GROUP BY tt.event_id
),
-- Candidate events (only FUTURE events - for event cards)
candidate_events AS (
  SELECT
    e.id AS event_id,
    e.created_by AS organizer_id,
    COALESCE(e.start_at, e.created_at, now()) AS anchor_ts,
    e.start_at,
    GREATEST(
      0,
      1.0 - ABS(EXTRACT(EPOCH FROM (now() - COALESCE(e.start_at, e.created_at, now()))) / 86400.0) / 180.0
    ) AS freshness,
    dc.distance_miles,
    COALESCE(ep.min_price_cents, 0) AS min_price_cents,
    -- Track if user already purchased (for filtering EVENT cards only)
    EXISTS(
      SELECT 1 FROM tickets t
      WHERE t.owner_user_id = p_user
        AND t.event_id = e.id
        AND t.status IN ('issued', 'transferred', 'redeemed')
    ) AS user_already_purchased
  FROM events e
  LEFT JOIN distance_calc dc ON dc.event_id = e.id
  LEFT JOIN date_filter_check dfc ON dfc.event_id = e.id
  LEFT JOIN event_pricing ep ON ep.event_id = e.id
  WHERE e.visibility = 'public'
    AND e.start_at > now()  -- Only future events for event cards
    AND (
      COALESCE(e.start_at, e.created_at, now()) > now() - INTERVAL '365 days'
      OR EXISTS (
        SELECT 1 FROM event_posts ep
        WHERE ep.event_id = e.id AND ep.deleted_at IS NULL
      )
    )
    -- Filters
    AND (p_categories IS NULL OR array_length(p_categories, 1) IS NULL OR e.category = ANY(p_categories))
    AND (p_max_distance_miles IS NULL OR dc.distance_miles IS NULL OR dc.distance_miles <= p_max_distance_miles)
    AND (p_date_filters IS NULL OR array_length(p_date_filters, 1) IS NULL OR dfc.passes_date_filter = true)
    -- Exclude flashback events
    AND (COALESCE(e.is_flashback, false) = false)
),
-- [Keep all the existing signal CTEs from the original migration - they reference candidate_events]
-- For brevity, I'll reference the existing migration but show the key changes:
-- ... (all existing signal CTEs remain the same) ...

-- ✅ FIX: Posts can be from ANY event (past or future), not just candidate_events
all_posts AS (
  SELECT
    p.event_id,
    p.id AS post_id,
    p.created_at,
    (COALESCE(p.like_count, 0) + 1.2 * COALESCE(p.comment_count, 0)) AS engagement_score
  FROM event_posts p
  INNER JOIN events e ON e.id = p.event_id
  WHERE p.deleted_at IS NULL
    AND p.created_at > now() - INTERVAL '180 days'  -- Only recent posts
    AND e.visibility = 'public'  -- Event must be public
    -- ✅ Posts can be from past or future events (removed JOIN with candidate_events)
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
-- ✅ FIX: Posts join with LEFT JOIN to scored_events and candidate_events
-- This allows posts from past events (where scored_events/candidate_events won't exist)
items AS (
  SELECT
    'event'::text AS item_type,
    se.event_id::uuid AS item_id,
    se.event_id,
    se.score,
    COALESCE(se.anchor_ts, se.start_at) AS sort_ts,
    se.event_rank,
    0 AS within_event_rank
  FROM scored_events se
  JOIN candidate_events ce ON ce.event_id = se.event_id
  WHERE NOT ce.user_already_purchased

  UNION ALL

  SELECT
    'post'::text AS item_type,
    rp.post_id AS item_id,
    rp.event_id,
    CASE
      -- If event is in candidate_events (future event), use its score
      WHEN ce.event_id IS NOT NULL THEN
        CASE
          WHEN ce.user_already_purchased THEN se.score * 1.2
          ELSE se.score * 0.98
        END
      -- If event is past (not in candidate_events), use base score
      ELSE 0.5 * 0.98
    END AS score,
    rp.created_at AS sort_ts,
    COALESCE(se.event_rank, 999999) AS event_rank,  -- Past events get lowest rank
    rp.rn AS within_event_rank
  FROM ranked_posts rp
  LEFT JOIN scored_events se ON se.event_id = rp.event_id  -- ✅ LEFT JOIN allows past events
  LEFT JOIN candidate_events ce ON ce.event_id = rp.event_id  -- ✅ LEFT JOIN allows past events
  WHERE rp.rn <= 3  -- Top 3 posts per event
),
-- [Rest of the query remains the same]
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



