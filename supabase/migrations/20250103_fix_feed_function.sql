-- =====================================================
-- FIX: Restore working get_home_feed_ids and keep original return type
-- Tag affinity is computed internally but NOT returned (for backward compatibility)
-- =====================================================

-- Drop all old function versions first
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure 
        FROM pg_proc 
        WHERE proname = 'get_home_feed_ids' 
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
    END LOOP;
END $$;

-- Drop wrapper function versions
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure 
        FROM pg_proc 
        WHERE proname = 'get_home_feed_ranked' 
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.oid::regprocedure || ' CASCADE';
    END LOOP;
END $$;

-- This function already exists and works - we're just adding tag affinity to the scoring
-- WITHOUT changing the return type
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
  exploration_bonus AS (SELECT 0.005::numeric AS bonus), 
  distance_calc AS (
    SELECT
      e.id AS event_id,
      CASE
        WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL 
             AND e.lat IS NOT NULL AND e.lng IS NOT NULL THEN
          3959 * acos(
            LEAST(1.0, GREATEST(-1.0,
              cos(radians(p_user_lat)) * cos(radians(e.lat)) * 
              cos(radians(e.lng) - radians(p_user_lng)) + 
              sin(radians(p_user_lat)) * sin(radians(e.lat))
            ))
          )
        ELSE NULL
      END AS distance_miles
    FROM events.events e
  ),
  candidate_events AS (
    SELECT
      e.id,
      e.start_at,
      GREATEST(0, 1.0 - (EXTRACT(EPOCH FROM (e.start_at - now())) / (86400.0 * 30)))::numeric AS freshness
    FROM events.events e
    WHERE e.start_at > now()
      AND e.start_at < now() + interval '90 days'
      AND e.visibility = 'public'
      -- Category filter
      AND (p_categories IS NULL OR e.category = ANY(p_categories))
      -- Distance filter
      AND (
        p_max_distance_miles IS NULL 
        OR EXISTS (
          SELECT 1 FROM distance_calc dc 
          WHERE dc.event_id = e.id 
          AND dc.distance_miles <= p_max_distance_miles
        )
      )
      -- Cursor pagination
      AND (p_cursor_item_id IS NULL OR e.id != p_cursor_item_id)
  ),
  engagement AS (
    SELECT
      p.event_id,
      COALESCE(SUM(p.like_count + p.comment_count * 1.5), 0)::numeric AS eng_score
    FROM events.event_posts p
    WHERE p.deleted_at IS NULL
    GROUP BY p.event_id
  ),
  affinity AS (
    SELECT
      e.id AS event_id,
      COALESCE((SELECT 1.0 FROM users.follows f WHERE f.follower_user_id = p_user AND f.target_type = 'event' AND f.target_id = e.id LIMIT 1), 0) +
      COALESCE((SELECT 0.8 FROM users.follows f WHERE f.follower_user_id = p_user AND f.target_type = 'organizer' AND f.target_id = e.created_by LIMIT 1), 0) +
      COALESCE((SELECT 1.2 FROM ticketing.tickets t WHERE t.owner_user_id = p_user AND t.event_id = e.id LIMIT 1), 0) +
      COALESCE((SELECT 0.5 FROM distance_calc dc WHERE dc.event_id = e.id AND dc.distance_miles <= 10 LIMIT 1), 0) +
      COALESCE((SELECT 0.3 FROM distance_calc dc WHERE dc.event_id = e.id AND dc.distance_miles > 10 AND dc.distance_miles <= 25 LIMIT 1), 0) AS base_affinity
    FROM events.events e
  ),
  tag_affinity_cte AS (
    SELECT
      e.id AS event_id,
      COALESCE(SUM(utp.weight), 0)::numeric AS tag_score,
      ARRAY_AGG(DISTINCT utp.tag) FILTER (WHERE utp.tag IS NOT NULL) AS matched_tags
    FROM events.events e
    LEFT JOIN public.user_tag_preferences utp ON (
      p_user IS NOT NULL
      AND utp.user_id = p_user
      AND utp.tag = ANY(e.tags)
    )
    GROUP BY e.id
  ),
  -- Collaborative recommendations for this user, normalized to [0,1]
  collab_raw AS (
    SELECT
      cr.event_id,
      cr.recommendation_score
    FROM public.get_collaborative_recommendations(p_user, 200) cr
  ),
  collab_norm AS (
    SELECT
      s.event_id,
      s.recommendation_score,
      CASE
        WHEN s.max_rec_score > 0 THEN s.recommendation_score / s.max_rec_score
        ELSE 0
      END AS collab_score_norm
    FROM (
      SELECT
        cr.event_id,
        cr.recommendation_score,
        MAX(cr.recommendation_score) OVER () AS max_rec_score
      FROM collab_raw cr
    ) s
  ),
  scored_events AS (
    SELECT
      ce.id,
      ce.freshness,
      COALESCE(eng.eng_score, 0) AS engagement,
      COALESCE(aff.base_affinity, 0) AS affinity,
      COALESCE(ta.tag_score, 0) AS tag_affinity_val,
      ta.matched_tags,
      ce.start_at,
      COALESCE(cn.collab_score_norm, 0) AS collab_score,
      (
        -- Core signals
        0.35 * GREATEST(0.01, ce.freshness) +
        0.20 * GREATEST(0.01, COALESCE(eng.eng_score, 0)) +
        0.25 * GREATEST(0.01, COALESCE(aff.base_affinity, 0)) +
        0.15 * GREATEST(0.01, COALESCE(ta.tag_score, 0)) +
        -- Collaborative bonus (scaled)
        0.05 * GREATEST(0.01, COALESCE(cn.collab_score_norm, 0)) +
        eb.bonus
      )::numeric AS final_score
    FROM candidate_events ce
    CROSS JOIN exploration_bonus eb
    LEFT JOIN engagement eng ON eng.event_id = ce.id
    LEFT JOIN affinity aff ON aff.event_id = ce.id
    LEFT JOIN tag_affinity_cte ta ON ta.event_id = ce.id
    LEFT JOIN collab_norm cn ON cn.event_id = ce.id
  ),
  all_posts AS (
    SELECT
      p.event_id,
      p.id AS post_id,
      p.created_at,
      -- ✅ Boost media posts by 50% (photos/videos are more engaging)
      (
        (COALESCE(p.like_count, 0) + 1.2 * COALESCE(p.comment_count, 0))
        * CASE 
            WHEN p.media_urls IS NOT NULL AND array_length(p.media_urls, 1) > 0 
            THEN 1.5  -- Media boost
            ELSE 1.0  -- Text only
          END
      )::numeric AS engagement_score,
      -- Flag for debugging
      (p.media_urls IS NOT NULL AND array_length(p.media_urls, 1) > 0) AS has_media
    FROM events.event_posts p
    WHERE p.deleted_at IS NULL
      AND p.created_at > now() - INTERVAL '180 days'
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
  items AS (
    -- Events
    SELECT
      'event'::text AS item_type,
      s.id AS item_id,
      s.id AS event_id,
      s.final_score AS score,
      s.start_at AS sort_ts
    FROM scored_events s
    
    UNION ALL
    
    -- Posts (top 3 per event)
    SELECT
      'post'::text AS item_type,
      rp.post_id AS item_id,
      rp.event_id,
      se.final_score * 0.98 AS score,
      rp.created_at AS sort_ts
    FROM ranked_posts rp
    JOIN scored_events se ON se.id = rp.event_id
    WHERE rp.rn <= 3
  )
  SELECT
    i.item_type,
    i.item_id,
    i.event_id,
    i.score,
    i.sort_ts
  FROM items i
  ORDER BY i.score DESC, i.sort_ts DESC, i.item_id DESC
  LIMIT p_limit;
$$;

-- Wrapper function matches the original working signature
CREATE OR REPLACE FUNCTION public.get_home_feed_ranked(
  p_user_id uuid,
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
  SELECT * FROM public.get_home_feed_ids(
    p_user_id, p_limit, p_cursor_item_id, p_categories,
    p_user_lat, p_user_lng, p_max_distance_miles, p_date_filters,
    p_session_id
  );
$$;

COMMENT ON FUNCTION public.get_home_feed_ranked IS 'Feed ranking wrapper - includes events AND posts with media boost and tag personalization';
COMMENT ON FUNCTION public.get_home_feed_ids IS 'Core feed algorithm with purchase intent, tag affinity, collaborative filtering, and media post boost';

-- NOTE: We do NOT create a public.events view because it causes RLS recursion
-- The Edge Function queries events.events directly via Supabase client
-- PostgREST access is not needed for this table

-- Grant permissions on functions
GRANT EXECUTE ON FUNCTION public.get_home_feed_ids TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_home_feed_ranked TO authenticated, anon;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';