-- First, drop the dependent policies that are causing issues
DROP POLICY IF EXISTS "posts_read_public_or_access" ON public.event_posts;
DROP POLICY IF EXISTS "posts_insert_authorized" ON public.event_posts;
DROP POLICY IF EXISTS "comments_read_public_or_access" ON public.event_comments;
DROP POLICY IF EXISTS "comments_insert_access" ON public.event_comments;
DROP POLICY IF EXISTS "reactions_read_public_or_access" ON public.event_reactions;
DROP POLICY IF EXISTS "reactions_insert_access" ON public.event_reactions;

-- Drop the problematic overloaded function
DROP FUNCTION IF EXISTS public.can_current_user_post(uuid, uuid) CASCADE;

-- Recreate the fixed function
CREATE OR REPLACE FUNCTION public.can_current_user_post(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (
      -- Direct event ownership check
      SELECT 1
      FROM public.events ev
      WHERE ev.id = p_event_id
        AND (
          ev.created_by = auth.uid()
          OR (
            ev.owner_context_type = 'individual'
            AND ev.owner_context_id = auth.uid()
          )
          OR (
            ev.owner_context_type = 'organization'
            AND EXISTS (
              SELECT 1 FROM public.org_memberships om
              WHERE om.org_id = ev.owner_context_id
                AND om.user_id = auth.uid()
                AND om.role::text IN ('owner','admin','editor')
            )
          )
        )
    )
    OR EXISTS (
      -- Valid ticket holder check
      SELECT 1
      FROM public.tickets t
      WHERE t.event_id = p_event_id
        AND t.owner_user_id = auth.uid()
        AND t.status::text IN ('issued','transferred','redeemed')
    );
$$;

-- Recreate the policies with fixed function calls
CREATE POLICY "posts_read_public_or_access" 
ON public.event_posts 
FOR SELECT 
USING (
  (deleted_at IS NULL) AND (
    EXISTS (
      SELECT 1
      FROM events e
      WHERE e.id = event_posts.event_id 
        AND e.visibility = 'public'
    ) 
    OR (
      auth.role() = 'authenticated' 
      AND (
        can_current_user_post(event_id) 
        OR EXISTS (
          SELECT 1
          FROM events e
          WHERE e.id = event_posts.event_id 
            AND e.visibility = 'unlisted'
        )
      )
    )
  )
);

CREATE POLICY "posts_insert_authorized" 
ON public.event_posts 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' 
  AND can_current_user_post(event_id) 
  AND author_user_id = auth.uid()
);

CREATE POLICY "comments_read_public_or_access" 
ON public.event_comments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM event_posts p
    JOIN events e ON e.id = p.event_id
    WHERE p.id = event_comments.post_id 
      AND p.deleted_at IS NULL 
      AND (
        e.visibility = 'public' 
        OR (
          auth.role() = 'authenticated' 
          AND (
            can_current_user_post(p.event_id) 
            OR e.visibility = 'unlisted'
          )
        )
      )
  )
);

CREATE POLICY "comments_insert_access" 
ON public.event_comments 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' 
  AND author_user_id = auth.uid() 
  AND EXISTS (
    SELECT 1
    FROM event_posts p
    JOIN events e ON e.id = p.event_id
    WHERE p.id = event_comments.post_id 
      AND p.deleted_at IS NULL 
      AND (
        e.visibility = 'public' 
        OR can_current_user_post(p.event_id) 
        OR e.visibility = 'unlisted'
      )
  )
);

CREATE POLICY "reactions_read_public_or_access" 
ON public.event_reactions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM event_posts p
    JOIN events e ON e.id = p.event_id
    WHERE p.id = event_reactions.post_id 
      AND p.deleted_at IS NULL 
      AND (
        e.visibility = 'public' 
        OR (
          auth.role() = 'authenticated' 
          AND (
            can_current_user_post(p.event_id) 
            OR e.visibility = 'unlisted'
          )
        )
      )
  )
);

CREATE POLICY "reactions_insert_access" 
ON public.event_reactions 
FOR INSERT 
WITH CHECK (
  auth.role() = 'authenticated' 
  AND user_id = auth.uid() 
  AND EXISTS (
    SELECT 1
    FROM event_posts p
    JOIN events e ON e.id = p.event_id
    WHERE p.id = event_reactions.post_id 
      AND p.deleted_at IS NULL 
      AND (
        e.visibility = 'public' 
        OR can_current_user_post(p.event_id) 
        OR e.visibility = 'unlisted'
      )
  )
);