-- Fix security issues and add RLS policies
-- 1. Fix search_path for functions
ALTER FUNCTION public.tg_touch_updated_at() SET search_path = public;
ALTER FUNCTION public.inc_like_count() SET search_path = public;
ALTER FUNCTION public.inc_comment_count() SET search_path = public;
ALTER FUNCTION public.can_current_user_post(UUID, UUID) SET search_path = public;

-- 2. Drop existing conflicting policies
DROP POLICY IF EXISTS "posts_read_public_or_manager" ON public.event_posts;
DROP POLICY IF EXISTS "posts_insert_ticket_or_org" ON public.event_posts;
DROP POLICY IF EXISTS "posts_update_author_or_admin" ON public.event_posts;
DROP POLICY IF EXISTS "posts_delete_author_or_admin" ON public.event_posts;
DROP POLICY IF EXISTS "comments_select_public" ON public.event_comments;
DROP POLICY IF EXISTS "comments_insert_any_auth" ON public.event_comments;
DROP POLICY IF EXISTS "comments_update_author_or_admin" ON public.event_comments;
DROP POLICY IF EXISTS "comments_delete_author_or_admin" ON public.event_comments;
DROP POLICY IF EXISTS "event_reactions_select_public" ON public.event_reactions;
DROP POLICY IF EXISTS "event_reactions_insert_auth" ON public.event_reactions;
DROP POLICY IF EXISTS "event_reactions_delete_self" ON public.event_reactions;

-- 3. Create new comprehensive RLS policies
-- Posts policies
CREATE POLICY "posts_read_public_or_access"
ON public.event_posts FOR SELECT
USING (
  deleted_at IS NULL AND (
    EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.visibility = 'public')
    OR (
      auth.role() = 'authenticated'
      AND (
        public.can_current_user_post(event_id, auth.uid())
        OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.visibility = 'unlisted')
      )
    )
  )
);

CREATE POLICY "posts_insert_authorized"
ON public.event_posts FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' 
  AND public.can_current_user_post(event_id, auth.uid()) 
  AND author_user_id = auth.uid()
);

CREATE POLICY "posts_modify_owner_or_org"
ON public.event_posts FOR UPDATE USING (
  auth.role() = 'authenticated'
  AND (
    author_user_id = auth.uid()
    OR is_event_manager(event_id)
  )
);

CREATE POLICY "posts_delete_owner_or_org"
ON public.event_posts FOR DELETE USING (
  auth.role() = 'authenticated'
  AND (
    author_user_id = auth.uid()
    OR is_event_manager(event_id)
  )
);

-- Comments policies
CREATE POLICY "comments_read_public_or_access"
ON public.event_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.event_posts p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = post_id 
      AND p.deleted_at IS NULL
      AND (
        e.visibility = 'public'
        OR (
          auth.role() = 'authenticated' 
          AND (
            public.can_current_user_post(p.event_id, auth.uid()) 
            OR e.visibility = 'unlisted'
          )
        )
      )
  )
);

CREATE POLICY "comments_insert_access"
ON public.event_comments FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND author_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.event_posts p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = post_id
      AND p.deleted_at IS NULL
      AND (
        e.visibility = 'public'
        OR public.can_current_user_post(p.event_id, auth.uid())
        OR e.visibility = 'unlisted'
      )
  )
);

CREATE POLICY "comments_update_author_or_manager"
ON public.event_comments FOR UPDATE USING (
  auth.role() = 'authenticated'
  AND (
    author_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.event_posts p
      WHERE p.id = post_id AND is_event_manager(p.event_id)
    )
  )
);

CREATE POLICY "comments_delete_author_or_manager"
ON public.event_comments FOR DELETE USING (
  auth.role() = 'authenticated'
  AND (
    author_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.event_posts p
      WHERE p.id = post_id AND is_event_manager(p.event_id)
    )
  )
);

-- Reactions policies
CREATE POLICY "reactions_read_public_or_access"
ON public.event_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.event_posts p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = post_id 
      AND p.deleted_at IS NULL
      AND (
        e.visibility = 'public'
        OR (
          auth.role() = 'authenticated' 
          AND (
            public.can_current_user_post(p.event_id, auth.uid()) 
            OR e.visibility = 'unlisted'
          )
        )
      )
  )
);

CREATE POLICY "reactions_insert_access"
ON public.event_reactions FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' 
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.event_posts p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = post_id
      AND p.deleted_at IS NULL
      AND (
        e.visibility = 'public'
        OR public.can_current_user_post(p.event_id, auth.uid())
        OR e.visibility = 'unlisted'
      )
  )
);

CREATE POLICY "reactions_delete_self"
ON public.event_reactions FOR DELETE
USING (auth.role() = 'authenticated' AND user_id = auth.uid());