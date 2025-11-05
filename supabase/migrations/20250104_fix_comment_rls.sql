-- Fix event_comments RLS policies to use schema-qualified function names
-- This fixes the 500 error when posting comments

-- Drop problematic policies and recreate with correct schema qualification
DROP POLICY IF EXISTS "event_comments_insert_authorized" ON events.event_comments;
DROP POLICY IF EXISTS "event_comments_select_public_or_access" ON events.event_comments;

-- Recreate INSERT policy with schema-qualified function
CREATE POLICY "event_comments_insert_authorized"
ON events.event_comments
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (
  (auth.role() = 'authenticated'::text) 
  AND (author_user_id = auth.uid()) 
  AND (EXISTS (
    SELECT 1
    FROM events.event_posts p
    JOIN events.events e ON e.id = p.event_id
    WHERE p.id = event_comments.post_id 
      AND public.can_current_user_post(e.id)  -- Schema-qualified
      AND p.deleted_at IS NULL
  ))
);

-- Recreate SELECT policy with schema-qualified function
CREATE POLICY "event_comments_select_public_or_access"
ON events.event_comments
AS PERMISSIVE
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM events.event_posts p
    JOIN events.events e ON e.id = p.event_id
    WHERE p.id = event_comments.post_id 
      AND (
        e.visibility = 'public'::event_visibility 
        OR (
          (auth.role() = 'authenticated'::text) 
          AND (
            public.can_current_user_post(e.id)  -- Schema-qualified
            OR e.visibility = 'unlisted'::event_visibility
          )
        )
      )
      AND p.deleted_at IS NULL
  )
);

-- Also fix the "Organizers can pin comments" policy
DROP POLICY IF EXISTS "Organizers can pin comments" ON events.event_comments;

CREATE POLICY "Organizers can pin comments"
ON events.event_comments
AS PERMISSIVE
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM events.event_posts ep
    WHERE ep.id = event_comments.post_id 
      AND public.is_event_manager(ep.event_id)  -- Schema-qualified
  )
);

-- Fix the delete policy with is_event_manager
DROP POLICY IF EXISTS "event_comments_delete_author_or_manager" ON events.event_comments;

CREATE POLICY "event_comments_delete_author_or_manager"
ON events.event_comments
AS PERMISSIVE
FOR DELETE
TO public
USING (
  (auth.role() = 'authenticated'::text) 
  AND (
    (author_user_id = auth.uid()) 
    OR (EXISTS (
      SELECT 1
      FROM events.event_posts p
      WHERE p.id = event_comments.post_id 
        AND public.is_event_manager(p.event_id)  -- Schema-qualified
    ))
  )
);

-- Fix the update policy with is_event_manager
DROP POLICY IF EXISTS "event_comments_update_author_or_manager" ON events.event_comments;

CREATE POLICY "event_comments_update_author_or_manager"
ON events.event_comments
AS PERMISSIVE
FOR UPDATE
TO public
USING (
  (auth.role() = 'authenticated'::text) 
  AND (
    (author_user_id = auth.uid()) 
    OR (EXISTS (
      SELECT 1
      FROM events.event_posts p
      WHERE p.id = event_comments.post_id 
        AND public.is_event_manager(p.event_id)  -- Schema-qualified
    ))
  )
)
WITH CHECK (
  (auth.role() = 'authenticated'::text) 
  AND (
    (author_user_id = auth.uid()) 
    OR (EXISTS (
      SELECT 1
      FROM events.event_posts p
      WHERE p.id = event_comments.post_id 
        AND public.is_event_manager(p.event_id)  -- Schema-qualified
    ))
  )
);

COMMENT ON POLICY "event_comments_insert_authorized" ON events.event_comments IS
'Fixed to use schema-qualified public.can_current_user_post to prevent 500 errors';





