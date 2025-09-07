-- Complete the RLS policies for event_posts and event_comments (without realtime parts that already exist)

-- Event Posts policies
CREATE POLICY "posts_read_public_or_access" 
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

CREATE POLICY "posts_insert_authorized" 
ON public.event_posts FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' 
  AND author_user_id = auth.uid() 
  AND can_current_user_post(event_id)
);

CREATE POLICY "posts_modify_owner_or_org" 
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

CREATE POLICY "posts_delete_owner_or_org" 
ON public.event_posts FOR DELETE 
USING (
  auth.role() = 'authenticated' 
  AND (
    author_user_id = auth.uid() 
    OR is_event_manager(event_id)
  )
);

-- Event Comments policies
CREATE POLICY "comments_read_public_or_access" 
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

CREATE POLICY "comments_insert_access" 
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

CREATE POLICY "comments_update_author_or_manager" 
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

CREATE POLICY "comments_delete_author_or_manager" 
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

-- Only add tables to realtime if they're not already there
DO $$
BEGIN
  -- Try to add event_comments (it's not already in realtime)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_comments;
  EXCEPTION 
    WHEN duplicate_object THEN
      -- Already added, ignore
      NULL;
  END;
  
  -- Try to add event_reactions (it's not already in realtime)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.event_reactions;
  EXCEPTION 
    WHEN duplicate_object THEN
      -- Already added, ignore
      NULL;
  END;
END $$;

-- Set replica identity for realtime (safe to run even if already set)
ALTER TABLE public.event_posts REPLICA IDENTITY FULL;
ALTER TABLE public.event_comments REPLICA IDENTITY FULL;
ALTER TABLE public.event_reactions REPLICA IDENTITY FULL;