-- Balanced Feed with Extended Window and Post Capping
-- This migration extends the feed window to 180 days with balanced scoring and post limits

-- Update get_home_feed_ids function with improved algorithm
CREATE OR REPLACE FUNCTION public.get_home_feed_ids(
  p_user uuid,
  p_limit int DEFAULT 80,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  item_type text,
  item_id uuid,
  event_id uuid,
  score numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH
candidate_events AS (
  SELECT
    e.id AS event_id,
    /* symmetric linear decay over 180 days around NOW */
    GREATEST(
      0,
      1.0 - ABS(EXTRACT(EPOCH FROM (now() - e.start_at)) / 86400.0) / 180.0
    ) AS freshness
  FROM events e
  WHERE e.visibility = 'public'
    AND e.start_at > now() - INTERVAL '180 days'
),
engagement AS (
  SELECT
    p.event_id,
    COALESCE(SUM(p.like_count),0) * 1.0
    + COALESCE(SUM(p.comment_count),0) * 1.5 AS engagement
  FROM event_posts p
  WHERE p.deleted_at IS NULL
  GROUP BY 1
),
affinity AS (
  SELECT e.id AS event_id,
         COALESCE(follow_evt.weight,0)
       + COALESCE(follow_org.weight,0)
       + COALESCE(ticket_affinity.weight,0) AS affinity
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
    COALESCE(MAX(freshness),  0.001) AS max_fresh,
    COALESCE(MAX(engagement), 0.001) AS max_eng,
    COALESCE(MAX(affinity),   0.001) AS max_aff
  FROM z
),
scored_events AS (
  SELECT
    z.event_id,
    (0.60 * (z.freshness  / s.max_fresh)) +
    (0.25 * (z.engagement / s.max_eng)) +
    (0.15 * (z.affinity   / s.max_aff)) AS base_score
  FROM z, stats s
),
all_posts AS (
  SELECT
    p.event_id,
    p.id AS post_id,
    p.created_at,
    (COALESCE(p.like_count,0) + 1.2 * COALESCE(p.comment_count,0)) AS engagement_score
  FROM event_posts p
  WHERE p.deleted_at IS NULL
    AND p.created_at > now() - INTERVAL '180 days'  -- keep in-window
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
  SELECT
    'event'::text AS item_type,
    e.event_id::uuid AS item_id,
    e.event_id,
    e.base_score AS score,
    NULL::timestamptz AS created_at,
    0::numeric AS engagement_score
  FROM scored_events e

  UNION ALL

  SELECT
    'post'::text AS item_type,
    rp.post_id AS item_id,
    rp.event_id,
    e.base_score * 0.98 AS score,
    rp.created_at,
    rp.engagement_score
  FROM ranked_posts rp
  JOIN scored_events e ON e.event_id = rp.event_id
  WHERE rp.rn <= 3  -- cap posts per event
)
SELECT item_type, item_id, event_id, score
FROM items
ORDER BY
  score DESC,
  engagement_score DESC NULLS LAST,
  created_at DESC NULLS LAST,
  event_id DESC,
  item_id DESC
LIMIT p_limit OFFSET p_offset;
$$;
