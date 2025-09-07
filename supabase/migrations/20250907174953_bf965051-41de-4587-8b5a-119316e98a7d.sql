-- Drop existing views first to avoid conflicts
DROP VIEW IF EXISTS public.events_enhanced CASCADE;
DROP VIEW IF EXISTS public.event_recent_posts_top3 CASCADE;

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

-- 1.2 Rollup view: posts/comments counts per event
CREATE VIEW public.events_enhanced AS
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
CREATE VIEW public.event_recent_posts_top3 AS
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

-- 2) Exact counters for likes & comments (no drift)

-- 2.1 Comments → post.comment_count
CREATE OR REPLACE FUNCTION public._bump_comment_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.event_posts
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.event_posts
    SET comment_count = GREATEST(comment_count - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_comments_count_ins ON public.event_comments;
CREATE TRIGGER trg_event_comments_count_ins
AFTER INSERT ON public.event_comments
FOR EACH ROW EXECUTE FUNCTION public._bump_comment_count();

DROP TRIGGER IF EXISTS trg_event_comments_count_del ON public.event_comments;
CREATE TRIGGER trg_event_comments_count_del
AFTER DELETE ON public.event_comments
FOR EACH ROW EXECUTE FUNCTION public._bump_comment_count();

-- 2.2 Reactions(kind='like') → post.like_count
CREATE OR REPLACE FUNCTION public._bump_like_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.kind = 'like' THEN
      UPDATE public.event_posts
      SET like_count = like_count + 1
      WHERE id = NEW.post_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.kind = 'like' THEN
      UPDATE public.event_posts
      SET like_count = GREATEST(like_count - 1, 0)
      WHERE id = OLD.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_reactions_like_ins ON public.event_reactions;
CREATE TRIGGER trg_event_reactions_like_ins
AFTER INSERT ON public.event_reactions
FOR EACH ROW EXECUTE FUNCTION public._bump_like_count();

DROP TRIGGER IF EXISTS trg_event_reactions_like_del ON public.event_reactions;
CREATE TRIGGER trg_event_reactions_like_del
AFTER DELETE ON public.event_reactions
FOR EACH ROW EXECUTE FUNCTION public._bump_like_count();

-- 3) RLS policies that match your rules

-- Ensure RLS is ON
ALTER TABLE public.event_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "posts_read_public_or_access" ON public.event_posts;
DROP POLICY IF EXISTS "posts_read_public" ON public.event_posts;
DROP POLICY IF EXISTS "posts_insert_authorized" ON public.event_posts;
DROP POLICY IF EXISTS "posts_modify_owner_or_org" ON public.event_posts;
DROP POLICY IF EXISTS "posts_delete_owner_or_org" ON public.event_posts;

DROP POLICY IF EXISTS "comments_read_public_or_access" ON public.event_comments;
DROP POLICY IF EXISTS "comments_insert_access" ON public.event_comments;
DROP POLICY IF EXISTS "comments_update_author_or_manager" ON public.event_comments;
DROP POLICY IF EXISTS "comments_delete_author_or_manager" ON public.event_comments;

-- READ posts
CREATE POLICY "read_event_posts"
ON public.event_posts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = event_posts.event_id
      AND (
        e.visibility = 'public'
        OR e.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.tickets t
          WHERE t.event_id = e.id
            AND t.owner_user_id = auth.uid()
            AND t.status = 'issued'
        )
      )
  )
);

-- INSERT posts
CREATE POLICY "insert_event_posts_organizer_or_ticket"
ON public.event_posts
FOR INSERT
WITH CHECK (
  auth.uid() = (SELECT e.created_by FROM public.events e WHERE e.id = event_posts.event_id)
  OR EXISTS (
    SELECT 1
    FROM public.tickets t
    WHERE t.event_id = event_posts.event_id
      AND t.owner_user_id = auth.uid()
      AND t.status = 'issued'
  )
);

-- UPDATE/DELETE posts (author or organizer)
CREATE POLICY "mutate_event_posts_author_or_org"
ON public.event_posts
FOR UPDATE USING (
  author_user_id = auth.uid()
  OR auth.uid() = (SELECT e.created_by FROM public.events e WHERE e.id = event_posts.event_id)
)
WITH CHECK (
  author_user_id = auth.uid()
  OR auth.uid() = (SELECT e.created_by FROM public.events e WHERE e.id = event_posts.event_id)
);

CREATE POLICY "delete_event_posts_author_or_org"
ON public.event_posts
FOR DELETE USING (
  author_user_id = auth.uid()
  OR auth.uid() = (SELECT e.created_by FROM public.events e WHERE e.id = event_posts.event_id)
);

-- READ comments (mirror post visibility)
CREATE POLICY "read_event_comments"
ON public.event_comments
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.event_posts p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = event_comments.post_id
      AND (
        e.visibility = 'public'
        OR e.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.tickets t
          WHERE t.event_id = e.id
            AND t.owner_user_id = auth.uid()
            AND t.status = 'issued'
        )
      )
  )
);

-- INSERT comments (organizer or ticket-holder)
CREATE POLICY "insert_event_comments_organizer_or_ticket"
ON public.event_comments
FOR INSERT WITH CHECK (
  auth.uid() = (
    SELECT e.created_by
    FROM public.events e
    JOIN public.event_posts p ON p.event_id = e.id
    WHERE p.id = event_comments.post_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.tickets t
    JOIN public.event_posts p ON p.event_id = t.event_id
    WHERE p.id = event_comments.post_id
      AND t.owner_user_id = auth.uid()
      AND t.status = 'issued'
  )
);

-- UPDATE/DELETE comments (author or organizer)
CREATE POLICY "mutate_event_comments_author_or_org"
ON public.event_comments
FOR UPDATE USING (
  author_user_id = auth.uid()
  OR auth.uid() = (
    SELECT e.created_by
    FROM public.events e
    JOIN public.event_posts p ON p.event_id = e.id
    WHERE p.id = event_comments.post_id
  )
)
WITH CHECK (
  author_user_id = auth.uid()
  OR auth.uid() = (
    SELECT e.created_by
    FROM public.events e
    JOIN public.event_posts p ON p.event_id = e.id
    WHERE p.id = event_comments.post_id
  )
);

CREATE POLICY "delete_event_comments_author_or_org"
ON public.event_comments
FOR DELETE USING (
  author_user_id = auth.uid()
  OR auth.uid() = (
    SELECT e.created_by
    FROM public.events e
    JOIN public.event_posts p ON p.event_id = e.id
    WHERE p.id = event_comments.post_id
  )
);

-- 4) Indexes (speed up all the hot paths)

-- Posts lookups by event / recency
CREATE INDEX IF NOT EXISTS idx_event_posts_event_created_at
  ON public.event_posts (event_id, created_at DESC);

-- Posts by author
CREATE INDEX IF NOT EXISTS idx_event_posts_author
  ON public.event_posts (author_user_id);

-- Tickets entitlement checks
CREATE INDEX IF NOT EXISTS idx_tickets_owner_event_status
  ON public.tickets (owner_user_id, event_id, status);

-- Comments / reactions
CREATE INDEX IF NOT EXISTS idx_event_comments_post_created
  ON public.event_comments (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_reactions_post_kind
  ON public.event_reactions (post_id, kind);

-- Events sort
CREATE INDEX IF NOT EXISTS idx_events_start_at
  ON public.events (start_at ASC);

-- 5) Realtime (optional but recommended)

-- Enable Realtime for the feeds (so new posts instantly appear in the home rails)
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_reactions;