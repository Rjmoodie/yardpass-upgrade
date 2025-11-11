-- Update get_home_feed_ids to hide past event CARDS while keeping posts from past events
-- Rule: Event cards should only show for FUTURE events, but posts can be from any event

CREATE OR REPLACE FUNCTION public.get_home_feed_ids(
  p_user uuid,
  p_limit integer DEFAULT 30,
  p_cursor_item_id uuid DEFAULT NULL,
  p_categories text[] DEFAULT NULL,
  p_user_lat double precision DEFAULT NULL,
  p_user_lng double precision DEFAULT NULL,
  p_max_distance_miles double precision DEFAULT NULL,
  p_date_filters text[] DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS TABLE (
  item_type text,
  item_id uuid,
  event_id uuid,
  score numeric,
  sort_ts timestamp with time zone
)
LANGUAGE sql
STABLE
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
      -- Freshness: Only positive scores for future events
      CASE
        WHEN e.start_at > now() THEN
          -- Future events: higher score for sooner events
          GREATEST(0.01, 1.0 - EXTRACT(EPOCH FROM (e.start_at - now())) / (90.0 * 86400))
        ELSE
          -- Past events: return very low score (will be filtered out as event cards)
          0.001
      END AS freshness,
      -- Cold start indicator
      (e.created_at > now() - interval '48 hours') AS is_new_event
    FROM events.events e
    LEFT JOIN distance_calc dc ON dc.event_id = e.id
    WHERE 
      -- ✅ FIX: Only include FUTURE events as candidates for event cards
      -- Posts from past events will still be included in all_posts CTE below
      e.start_at >= now()
      AND e.start_at < now() + interval '365 days'  -- Extended to 365 days (1 year) to show events planned well in advance
      AND e.visibility = 'public'
      AND (p_categories IS NULL OR e.category = ANY(p_categories))
      AND (p_max_distance_miles IS NULL OR dc.distance_miles IS NULL OR dc.distance_miles <= p_max_distance_miles)
  ),
  engagement AS (
    SELECT
      ce.id AS event_id,
      (
        LEAST(500, COALESCE(COUNT(DISTINCT ei.id) FILTER (WHERE ei.dwell_ms > 5000 AND ei.created_at > now() - interval '30 days'), 0)) * 0.5 +
        LEAST(1000, COALESCE(COUNT(DISTINCT t.id), 0)) * 10.0 +
        LEAST(500, COALESCE(COUNT(DISTINCT f.follower_user_id), 0)) * 5.0 +
        LEAST(5000, COALESCE(SUM(er.like_count), 0)) * 0.3 +
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
  normalized_scores AS (
    SELECT
      ce.id AS event_id,
      ce.freshness,
      ce.is_new_event,
      LEAST(10, GREATEST(0.01, LN(1 + COALESCE(eng.raw_eng_score, 0)))) AS eng_score_norm,
      LEAST(5, GREATEST(0.01, LN(1 + COALESCE(aff.raw_affinity, 0)))) AS affinity_norm,
      LEAST(10, GREATEST(0.01, LN(1 + COALESCE(ta.raw_tag_score, 0)))) AS tag_affinity_norm,
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
      CASE
        -- 🔥 Big cold-start boost for new events with low engagement
        WHEN ns.is_new_event AND ns.eng_score_norm < 1.0 THEN 0.5
        ELSE 0.005
      END AS explore_boost,
      (
        0.35 * GREATEST(0.01, ns.freshness) +
        0.20 * ns.eng_score_norm +
        0.25 * ns.affinity_norm +
        0.15 * ns.tag_affinity_norm +
        0.05 * ns.collab_score +
        CASE
          -- 🔥 Big cold-start boost for new events with low engagement (expires after 48h)
          WHEN ns.is_new_event AND ns.eng_score_norm < 1.0 THEN 0.5
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
            THEN 1.5
            ELSE 1.0
          END
      )::numeric AS engagement_score
    FROM events.event_posts p
    WHERE p.deleted_at IS NULL
      -- ✅ Posts can be from past events (up to 180 days)
      AND p.created_at > now() - INTERVAL '180 days'
  ),
  ranked_posts AS (
    SELECT
      ap.*,
      ROW_NUMBER() OVER (
        PARTITION BY ap.event_id
        ORDER BY 
          ap.has_media DESC,
          ap.created_at DESC,
          ap.engagement_score DESC,
          ap.post_id DESC
      ) AS rn
    FROM all_posts ap
  ),
  items AS (
    -- ✅ Event cards: Only from candidate_events (future events only)
    SELECT
      'event'::text AS item_type,
      s.id AS item_id,
      s.id AS event_id,
      s.final_score AS score,
      s.start_at AS sort_ts
    FROM scored_events s
    
    UNION ALL
    
    -- ✅ Posts: Can be from ANY event (past or future) that has posts
    SELECT
      'post'::text AS item_type,
      rp.post_id AS item_id,
      rp.event_id,
      -- Give posts from future events slightly higher score
      COALESCE(se.final_score, 0.5) * 0.98 AS score,
      rp.created_at AS sort_ts
    FROM ranked_posts rp
    LEFT JOIN scored_events se ON se.id = rp.event_id  -- LEFT JOIN allows posts from past events
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

COMMENT ON FUNCTION public.get_home_feed_ids IS 
  'Get feed items - Event cards: future only, Posts: past and future';

