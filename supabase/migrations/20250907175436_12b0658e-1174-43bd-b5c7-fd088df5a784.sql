-- Drop existing policies and recreate them properly

-- Drop all existing policies for event_posts
DROP POLICY IF EXISTS "posts_read_public_or_access" ON public.event_posts;
DROP POLICY IF EXISTS "posts_insert_authorized" ON public.event_posts;
DROP POLICY IF EXISTS "posts_modify_owner_or_org" ON public.event_posts;
DROP POLICY IF EXISTS "posts_delete_owner_or_org" ON public.event_posts;
DROP POLICY IF EXISTS "read_event_posts" ON public.event_posts;
DROP POLICY IF EXISTS "insert_event_posts_organizer_or_ticket" ON public.event_posts;
DROP POLICY IF EXISTS "mutate_event_posts_author_or_org" ON public.event_posts;
DROP POLICY IF EXISTS "delete_event_posts_author_or_org" ON public.event_posts;

-- Drop all existing policies for event_comments
DROP POLICY IF EXISTS "comments_read_public_or_access" ON public.event_comments;
DROP POLICY IF EXISTS "comments_insert_access" ON public.event_comments;
DROP POLICY IF EXISTS "comments_update_author_or_manager" ON public.event_comments;
DROP POLICY IF EXISTS "comments_delete_author_or_manager" ON public.event_comments;
DROP POLICY IF EXISTS "read_event_comments" ON public.event_comments;
DROP POLICY IF EXISTS "insert_event_comments_organizer_or_ticket" ON public.event_comments;
DROP POLICY IF EXISTS "mutate_event_comments_author_or_org" ON public.event_comments;
DROP POLICY IF EXISTS "delete_event_comments_author_or_org" ON public.event_comments;

-- Create final RLS policies for event_posts
CREATE POLICY "event_posts_select_public_or_access" 
ON public.event_posts FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_posts.event_id 
    AND (
      e.visibility = 'public'::event_visibility 
      OR (auth.role() = 'authenticated' AND (
        can_current_user_post(e.id) 
        OR e.visibility = 'unlisted'::event_visibility
      ))
    ) 
    AND event_posts.deleted_at IS NULL
  )
);

CREATE POLICY "event_posts_insert_authorized" 
ON public.event_posts FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' 
  AND author_user_id = auth.uid() 
  AND can_current_user_post(event_id)
);

CREATE POLICY "event_posts_update_author_or_manager" 
ON public.event_posts FOR UPDATE 
USING (
  auth.role() = 'authenticated' 
  AND (
    author_user_id = auth.uid() 
    OR is_event_manager(event_id)
  )
)
WITH CHECK (
  auth.role() = 'authenticated' 
  AND (
    author_user_id = auth.uid() 
    OR is_event_manager(event_id)
  )
);

CREATE POLICY "event_posts_delete_author_or_manager" 
ON public.event_posts FOR DELETE 
USING (
  auth.role() = 'authenticated' 
  AND (
    author_user_id = auth.uid() 
    OR is_event_manager(event_id)
  )
);

-- Create final RLS policies for event_comments  
CREATE POLICY "event_comments_select_public_or_access" 
ON public.event_comments FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.event_posts p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = event_comments.post_id 
    AND (
      e.visibility = 'public'::event_visibility 
      OR (auth.role() = 'authenticated' AND (
        can_current_user_post(e.id) 
        OR e.visibility = 'unlisted'::event_visibility
      ))
    ) 
    AND p.deleted_at IS NULL
  )
);

CREATE POLICY "event_comments_insert_authorized" 
ON public.event_comments FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' 
  AND author_user_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.event_posts p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = event_comments.post_id 
    AND can_current_user_post(e.id)
    AND p.deleted_at IS NULL
  )
);

CREATE POLICY "event_comments_update_author_or_manager" 
ON public.event_comments FOR UPDATE 
USING (
  auth.role() = 'authenticated' 
  AND (
    author_user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.event_posts p
      WHERE p.id = event_comments.post_id 
      AND is_event_manager(p.event_id)
    )
  )
)
WITH CHECK (
  auth.role() = 'authenticated' 
  AND (
    author_user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.event_posts p
      WHERE p.id = event_comments.post_id 
      AND is_event_manager(p.event_id)
    )
  )
);

CREATE POLICY "event_comments_delete_author_or_manager" 
ON public.event_comments FOR DELETE 
USING (
  auth.role() = 'authenticated' 
  AND (
    author_user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.event_posts p
      WHERE p.id = event_comments.post_id 
      AND is_event_manager(p.event_id)
    )
  )
);