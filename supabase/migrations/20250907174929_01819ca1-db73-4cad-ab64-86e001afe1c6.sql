-- 1) Helper function + views + RPC (power the unified Home feed)

-- 1.1 Related events for a user (already exists, but ensuring it's up to date)
CREATE OR REPLACE FUNCTION public.user_related_event_ids(p_user_id uuid)
RETURNS TABLE(event_id uuid)
LANGUAGE sql
STABLE
AS $$
  SELECT e.id
  FROM public.events e
  WHERE e.created_by = p_user_id
  UNION
  SELECT t.event_id
  FROM public.tickets t
  WHERE t.owner_user_id = p_user_id
    AND t.status = 'issued';
$$;

-- 1.2 Drop and recreate the events_enhanced view to avoid column conflicts
DROP VIEW IF EXISTS public.events_enhanced;
CREATE OR REPLACE VIEW public.events_enhanced AS
SELECT
  e.*,
  COALESCE(p.posts_total, 0)::int    AS total_posts,
  COALESCE(p.comments_total, 0)::int AS total_comments,
  p.last_post_at
FROM public.events e
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)::bigint                       AS posts_total,
    COALESCE(SUM(comment_count),0)::bigint AS comments_total,
    MAX(created_at)                        AS last_post_at
  FROM public.event_posts ep
  WHERE ep.event_id = e.id
    AND ep.deleted_at IS NULL
) p ON true;

-- 1.3 Top 3 recent posts per event (with author + organizer flag)
DROP VIEW IF EXISTS public.event_recent_posts_top3;
CREATE OR REPLACE VIEW public.event_recent_posts_top3 AS
SELECT *
FROM (
  SELECT
    p.id,
    p.event_id,
    p.author_user_id,
    p.text,
    p.media_urls,
    p.created_at,
    p.like_count,
    p.comment_count,
    up.display_name AS author_name,
    up.photo_url    AS author_photo_url,
    (p.author_user_id = e.created_by) AS is_organizer,
    ROW_NUMBER() OVER (PARTITION BY p.event_id ORDER BY p.created_at DESC) AS rn
  FROM public.event_posts p
  JOIN public.events e ON e.id = p.event_id
  LEFT JOIN public.user_profiles up ON up.user_id = p.author_user_id
  WHERE p.deleted_at IS NULL
) x
WHERE rn <= 3;

-- 1.4 One-call RPC for Home feed (events + recent posts JSON)
CREATE OR REPLACE FUNCTION public.get_home_feed(
  p_user_id uuid,
  p_limit   int DEFAULT 20,
  p_offset  int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  category text,
  cover_image_url text,
  start_at timestamptz,
  end_at timestamptz,
  venue text,
  city text,
  created_by uuid,
  total_posts int,
  total_comments int,
  recent_posts jsonb
)
LANGUAGE sql
STABLE
AS $$
  WITH rel AS (
    SELECT event_id FROM public.user_related_event_ids(p_user_id)
  ),
  evs AS (
    SELECT e.*
    FROM public.events_enhanced e
    JOIN rel r ON r.event_id = e.id
    WHERE e.visibility = 'public' OR e.created_by = p_user_id
    ORDER BY e.start_at ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    e.id,
    e.title,
    e.description,
    e.category,
    e.cover_image_url,
    e.start_at,
    e.end_at,
    e.venue,
    e.city,
    e.created_by,
    e.total_posts,
    e.total_comments,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',           p.id,
            'authorName',   p.author_name,
            'authorUserId', p.author_user_id,
            'isOrganizer',  p.is_organizer,
            'content',      p.text,
            'mediaUrls',    p.media_urls,
            'likes',        p.like_count,
            'commentCount', p.comment_count,
            'createdAt',    p.created_at
          )
          ORDER BY p.created_at DESC
        )
        FROM public.event_recent_posts_top3 p
        WHERE p.event_id = e.id
      ),
      '[]'::jsonb
    ) AS recent_posts
  FROM evs e;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_home_feed(uuid, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_related_event_ids(uuid) TO anon, authenticated;