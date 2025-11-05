-- Migration: Improve recommendation system intelligence and fix bugs
-- Based on technical review feedback

-- Drop existing functions
DO $$ 
DECLARE r RECORD;
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH
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
      e.created_at,
      e.is_flashback,
      e.tags,
      dc.distance_miles,
      -- Freshness calculation: past events get negative score, future get positive
      CASE
        WHEN e.start_at > now() THEN
          -- Future events: higher score for sooner events
          GREATEST(0.01, 1.0 - EXTRACT(EPOCH FROM (e.start_at - now())) / (90.0 * 86400))
        ELSE
          -- Past events: decay score based on how long ago (max 30 days back)
          GREATEST(0.01, 0.3 - EXTRACT(EPOCH FROM (now() - e.start_at)) / (30.0 * 86400))
      END AS freshness,
      -- Cold start indicator
      (e.created_at > now() - interval '48 hours') AS is_new_event
    FROM events.events e
    LEFT JOIN distance_calc dc ON dc.event_id = e.id
    WHERE 
      -- Include events from past 30 days OR future 90 days
      e.start_at > now() - interval '30 days'
      AND e.start_at < now() + interval '90 days'
      AND e.visibility = 'public'
      AND (p_categories IS NULL OR e.category = ANY(p_categories))
      AND (p_max_distance_miles IS NULL OR dc.distance_miles IS NULL OR dc.distance_miles <= p_max_distance_miles)
  ),
  -- FIX: Group by ce.id instead of ei.event_id to avoid losing events with no impressions
  engagement AS (
    SELECT
      ce.id AS event_id,
      (
        -- Cap impressions to last 30 days and max 500 per event
        LEAST(500, COALESCE(COUNT(DISTINCT ei.id) FILTER (WHERE ei.dwell_ms > 5000 AND ei.created_at > now() - interval '30 days'), 0)) * 0.5 +
        -- Cap tickets to max 1000 per event
        LEAST(1000, COALESCE(COUNT(DISTINCT t.id), 0)) * 10.0 +
        -- Cap follows to max 500 per event
        LEAST(500, COALESCE(COUNT(DISTINCT f.follower_user_id), 0)) * 5.0 +
        -- Cap likes to max 5000 per event
        LEAST(5000, COALESCE(SUM(er.like_count), 0)) * 0.3 +
        -- Cap comments to max 2000 per event
        LEAST(2000, COALESCE(SUM(er.comment_count), 0)) * 0.4
      )::numeric AS raw_eng_score
    FROM candidate_events ce
    LEFT JOIN events.event_impressions ei ON ei.event_id = ce.id
    LEFT JOIN ticketing.tickets t ON t.event_id = ce.id
    LEFT JOIN users.follows f ON f.target_type = 'event' AND f.target_id = ce.id
    LEFT JOIN events.event_posts er ON er.event_id = ce.id AND er.deleted_at IS NULL
    GROUP BY ce.id
  ),
  affinity AS (
    SELECT
      ce.id AS event_id,
      CASE
        WHEN p_user IS NULL THEN 0.1
        ELSE (
          COALESCE(
            (SELECT 1.0 FROM ticketing.tickets WHERE owner_user_id = p_user AND event_id = ce.id LIMIT 1),
            0.0
          ) * 2.0 +
          COALESCE(
            (SELECT 1.0 FROM users.follows WHERE follower_user_id = p_user AND target_type = 'event' AND target_id = ce.id LIMIT 1),
            0.0
          ) * 1.5
        )
      END AS raw_affinity
    FROM candidate_events ce
  ),
  -- Simplified tag affinity calculation (avoid redundant joins)
  tag_affinity_cte AS (
    SELECT
      ce.id AS event_id,
      COALESCE(SUM(utp.weight), 0) AS raw_tag_score,
      ARRAY_AGG(DISTINCT utp.tag) FILTER (WHERE utp.tag IS NOT NULL) AS matched_tags
    FROM candidate_events ce
    LEFT JOIN public.user_tag_preferences utp 
      ON utp.user_id = p_user 
      AND utp.tag = ANY(ce.tags)
    GROUP BY ce.id
  ),
  collab AS (
    SELECT event_id, recommendation_score AS collab_score
    FROM public.get_collaborative_recommendations(p_user, 50)
  ),
  -- Normalize all scores using log-scaling to prevent whales from dominating
  normalized_scores AS (
    SELECT
      ce.id AS event_id,
      ce.freshness,
      ce.is_new_event,
      -- Log-scale and normalize engagement (cap at 10)
      LEAST(10, GREATEST(0.01, LN(1 + COALESCE(eng.raw_eng_score, 0)))) AS eng_score_norm,
      -- Log-scale and normalize affinity (cap at 5)
      LEAST(5, GREATEST(0.01, LN(1 + COALESCE(aff.raw_affinity, 0)))) AS affinity_norm,
      -- Log-scale and normalize tag affinity (cap at 10)
      LEAST(10, GREATEST(0.01, LN(1 + COALESCE(ta.raw_tag_score, 0)))) AS tag_affinity_norm,
      -- Collaborative score already normalized by get_collaborative_recommendations
      COALESCE(col.collab_score, 0) AS collab_score,
      ce.start_at,
      ta.matched_tags
    FROM candidate_events ce
    LEFT JOIN engagement eng ON eng.event_id = ce.id
    LEFT JOIN affinity aff ON aff.event_id = ce.id
    LEFT JOIN tag_affinity_cte ta ON ta.event_id = ce.id
    LEFT JOIN collab col ON col.event_id = ce.id
  ),
  scored_events AS (
    SELECT
      ns.event_id AS id,
      ns.freshness,
      ns.eng_score_norm AS engagement,
      ns.affinity_norm AS affinity,
      ns.tag_affinity_norm AS tag_affinity_val,
      ns.matched_tags,
      ns.start_at,
      ns.collab_score,
      -- Cold start exploration bonus: boost new events with no engagement
      CASE
        WHEN ns.is_new_event AND ns.eng_score_norm < 1.0 THEN 0.05
        ELSE 0.005
      END AS explore_boost,
      (
        -- Normalized weights (sum to 1.0)
        0.35 * GREATEST(0.01, ns.freshness) +
        0.20 * ns.eng_score_norm +
        0.25 * ns.affinity_norm +
        0.15 * ns.tag_affinity_norm +
        0.05 * ns.collab_score +
        CASE
          WHEN ns.is_new_event AND ns.eng_score_norm < 1.0 THEN 0.05
          ELSE 0.005
        END
      )::numeric AS final_score
    FROM normalized_scores ns
  ),
  all_posts AS (
    SELECT
      p.event_id,
      p.id AS post_id,
      p.created_at,
      p.media_urls,
      (p.media_urls IS NOT NULL AND array_length(p.media_urls, 1) > 0) AS has_media,
      (
        (COALESCE(p.like_count, 0) + 1.2 * COALESCE(p.comment_count, 0))
        * CASE 
            WHEN p.media_urls IS NOT NULL AND array_length(p.media_urls, 1) > 0 
            THEN 1.5  -- Media boost
            ELSE 1.0
          END
      )::numeric AS engagement_score
    FROM events.event_posts p
    WHERE p.deleted_at IS NULL
      AND p.created_at > now() - INTERVAL '180 days'
  ),
  -- Smarter post selection: favor media posts in ranking
  ranked_posts AS (
    SELECT
      ap.*,
      ROW_NUMBER() OVER (
        PARTITION BY ap.event_id
        ORDER BY 
          ap.has_media DESC,           -- Media posts first
          ap.created_at DESC,           -- Then most recent
          ap.engagement_score DESC,     -- Then most engaging
          ap.post_id DESC               -- Tie-breaker
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
    
    -- Posts (top 3 per event, prioritizing media)
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

-- Recreate wrapper
DO $$ 
DECLARE r RECORD;
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

CREATE OR REPLACE FUNCTION public.get_home_feed_ranked(
  p_user_id uuid DEFAULT NULL,
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT * FROM public.get_home_feed_ids(
    p_user_id,
    p_limit,
    p_cursor_item_id,
    p_categories,
    p_user_lat,
    p_user_lng,
    p_max_distance_miles,
    p_date_filters,
    p_session_id
  );
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_home_feed_ids TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_home_feed_ranked TO authenticated, anon;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Add comment explaining the improvements
COMMENT ON FUNCTION public.get_home_feed_ids IS 
'Intelligent feed ranking algorithm v2.0 with:
- Bug fix: GROUP BY ce.id instead of ei.event_id
- Log-normalization of all score components to prevent whales
- Per-signal caps (impressions, tickets, follows, likes, comments)
- Cold start boost for new events (48h window, 10x exploration bonus)
- Smarter post selection: media posts prioritized in ranking
- Simplified tag affinity calculation';





