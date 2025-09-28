-- Create personalized feed function with tunable weights (simplified version)
CREATE OR REPLACE FUNCTION public.get_home_feed_ids(
  p_user uuid,
  p_limit int default 80,
  p_offset int default 0
)
RETURNS TABLE (
  item_type text,        -- 'event' | 'post'
  item_id uuid,
  event_id uuid,
  score numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH
  -- candidate events: upcoming + recent past
  candidate_events AS (
    SELECT e.id as event_id,
           GREATEST(0,
             1.0 - (EXTRACT(EPOCH FROM (now() - LEAST(e.start_at, now()))) / 86400.0) / 14.0
           ) as freshness   -- decays over ~2 weeks
    FROM events e
    WHERE e.visibility = 'public'
      AND e.start_at > now() - INTERVAL '21 days'
  ),
  engagement AS (
    SELECT p.event_id,
           COALESCE(SUM(p.like_count),0) * 1.0
           + COALESCE(SUM(p.comment_count),0) * 1.5 as engagement
    FROM event_posts p
    WHERE p.deleted_at IS NULL
    GROUP BY 1
  ),
  affinity AS (
    -- follows + ticket purchases from this user
    SELECT e.id as event_id,
           COALESCE(follow_evt.weight,0)
           + COALESCE(follow_org.weight,0)
           + COALESCE(ticket_affinity.weight,0) as affinity
    FROM events e
    LEFT JOIN LATERAL (
      SELECT 1.0 as weight
      FROM follows ef
      WHERE ef.follower_user_id = p_user 
        AND ef.target_type = 'event' 
        AND ef.target_id = e.id
      LIMIT 1
    ) follow_evt ON true
    LEFT JOIN LATERAL (
      SELECT 0.8 as weight
      FROM follows ofo
      WHERE ofo.follower_user_id = p_user 
        AND ofo.target_type = 'organizer' 
        AND ofo.target_id = e.created_by
      LIMIT 1
    ) follow_org ON true
    LEFT JOIN LATERAL (
      SELECT 1.2 as weight
      FROM tickets t
      WHERE t.owner_user_id = p_user 
        AND t.event_id = e.id
        AND t.status IN ('issued', 'transferred', 'redeemed')
      LIMIT 1
    ) ticket_affinity ON true
  ),
  -- normalize to avoid one signal dominating
  z AS (
    SELECT
      ce.event_id,
      ce.freshness,
      COALESCE(e.engagement, 0) as engagement,
      COALESCE(a.affinity, 0)   as affinity
    FROM candidate_events ce
    LEFT JOIN engagement e ON e.event_id = ce.event_id
    LEFT JOIN affinity   a ON a.event_id = ce.event_id
  ),
  stats AS (
    SELECT
      GREATEST(MAX(freshness), 0.001)  as max_fresh,
      GREATEST(MAX(engagement), 0.001) as max_eng,
      GREATEST(MAX(affinity), 0.001)   as max_aff
    FROM z
  ),
  scored_events AS (
    SELECT
      z.event_id,
      -- weights: freshness 0.60, engagement 0.25, affinity 0.15
      (0.60 * (z.freshness  / s.max_fresh)) +
      (0.25 * (z.engagement / s.max_eng)) +
      (0.15 * (z.affinity   / s.max_aff)) as base_score
    FROM z, stats s
  ),
  -- attach representative post (most engaged recent) per event
  top_post AS (
    SELECT p.event_id, p.id as post_id
    FROM (
      SELECT
        p.*,
        ROW_NUMBER() OVER (PARTITION BY p.event_id
                           ORDER BY (COALESCE(p.like_count,0) + 1.2*COALESCE(p.comment_count,0)) DESC,
                                    p.created_at DESC) as rn
      FROM event_posts p
      WHERE p.deleted_at IS NULL
    ) p
    WHERE p.rn = 1
  ),
  items AS (
    -- emit each event once, and its top post as a second item (helps interleave)
    SELECT 'event'::text as item_type, e.event_id::uuid as item_id, e.event_id, e.base_score as score
    FROM scored_events e
    UNION ALL
    SELECT 'post', tp.post_id, tp.event_id, e.base_score * 0.98  -- slightly below the event item
    FROM top_post tp
    JOIN scored_events e ON e.event_id = tp.event_id
  )
  SELECT item_type, item_id, event_id, score
  FROM items
  ORDER BY score DESC
  LIMIT p_limit OFFSET p_offset
$$;