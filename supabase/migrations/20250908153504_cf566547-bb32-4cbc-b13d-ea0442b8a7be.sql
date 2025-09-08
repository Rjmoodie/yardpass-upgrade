-- Fix the feed scoring function
CREATE OR REPLACE FUNCTION public.get_home_feed_ids(p_user_id UUID, p_limit INT DEFAULT 12)
RETURNS TABLE (
  event_id UUID,
  score NUMERIC
)
LANGUAGE SQL STABLE AS $$
  WITH base AS (
    -- recent events and/or those with recent posts
    SELECT
      e.id AS event_id,
      -- Freshness: future events score higher, with a decay for very distant events
      CASE 
        WHEN e.start_at > now() THEN 
          -- Future events: score higher for events closer to now
          GREATEST(0.1, 1.0 / (1 + EXTRACT(EPOCH FROM (e.start_at - now())) / 86400.0))
        ELSE 
          -- Past events: very low score but not zero
          0.05
      END AS freshness,
      -- Engagement: likes + comments from posts in last 7 days
      COALESCE((
        SELECT SUM(COALESCE(p.like_count,0) + COALESCE(p.comment_count,0))
        FROM event_posts p
        WHERE p.event_id = e.id
          AND p.created_at >= now() - INTERVAL '7 days'
          AND p.deleted_at IS NULL
      ), 0) AS engagement,
      -- Affinity: follows on organizer or event by this user
      CASE
        WHEN p_user_id IS NULL THEN 0
        ELSE (
          SELECT COUNT(1)::NUMERIC
          FROM follows f
          WHERE f.follower_user_id = p_user_id
            AND (
              (f.target_type = 'event' AND f.target_id = e.id)
              OR (f.target_type = 'organizer' AND f.target_id = e.owner_context_id)
            )
        )
      END AS affinity
    FROM events e
    WHERE e.visibility IN ('public', 'unlisted')
  )
  SELECT
    event_id,
    -- Tune weights: freshness 0.6, engagement 0.3, affinity 0.1
    (freshness * 0.6) + (LEAST(1, engagement / 10.0) * 0.3) + (LEAST(1, affinity) * 0.1) AS score
  FROM base
  ORDER BY score DESC
  LIMIT p_limit
$$;