-- Fix event_reactions RLS policies to use schema-qualified function names
-- This fixes the 400 error when liking posts (same issue as comments)

-- Drop problematic policies
DROP POLICY IF EXISTS "reactions_insert_access" ON events.event_reactions;
DROP POLICY IF EXISTS "reactions_read_public_or_access" ON events.event_reactions;

-- Recreate INSERT policy with schema-qualified function
CREATE POLICY "reactions_insert_access"
ON events.event_reactions
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (
  (auth.role() = 'authenticated'::text) 
  AND (user_id = auth.uid()) 
  AND (EXISTS (
    SELECT 1
    FROM events.event_posts p
    JOIN events.events e ON e.id = p.event_id
    WHERE p.id = event_reactions.post_id 
      AND p.deleted_at IS NULL 
      AND (
        e.visibility = 'public'::event_visibility 
        OR public.can_current_user_post(p.event_id)  -- Schema-qualified
        OR e.visibility = 'unlisted'::event_visibility
      )
  ))
);

-- Recreate SELECT policy with schema-qualified function
CREATE POLICY "reactions_read_public_or_access"
ON events.event_reactions
AS PERMISSIVE
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM events.event_posts p
    JOIN events.events e ON e.id = p.event_id
    WHERE p.id = event_reactions.post_id 
      AND p.deleted_at IS NULL 
      AND (
        e.visibility = 'public'::event_visibility 
        OR (
          (auth.role() = 'authenticated'::text) 
          AND (
            public.can_current_user_post(p.event_id)  -- Schema-qualified
            OR e.visibility = 'unlisted'::event_visibility
          )
        )
      )
  )
);

COMMENT ON POLICY "reactions_insert_access" ON events.event_reactions IS
'Fixed to use schema-qualified public.can_current_user_post to prevent RLS recursion';





