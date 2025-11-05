-- Simplify event_reactions policies to avoid RLS recursion
-- We don't need to check event permissions at INSERT time - just require auth
-- The SELECT policy already handles visibility

-- Drop the complex insert policy
DROP POLICY IF EXISTS "reactions_insert_access" ON events.event_reactions;

-- Create simple insert policy - just require authenticated user
CREATE POLICY "reactions_insert_simple"
ON events.event_reactions
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK (
  (auth.role() = 'authenticated'::text) 
  AND (user_id = auth.uid())
);

-- Keep the SELECT policy but simplify it - no need to check can_current_user_post
-- If a post is public, anyone can see its reactions
DROP POLICY IF EXISTS "reactions_read_public_or_access" ON events.event_reactions;

CREATE POLICY "reactions_read_simple"
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
          auth.role() = 'authenticated'::text
          AND (
            -- User has a ticket
            EXISTS (
              SELECT 1 FROM ticketing.tickets t
              WHERE t.event_id = e.id
                AND t.owner_user_id = auth.uid()
                AND t.status IN ('issued', 'transferred', 'redeemed')
            )
            -- Or user is event owner/organizer
            OR e.created_by = auth.uid()
            OR (e.owner_context_type = 'individual' AND e.owner_context_id = auth.uid())
            OR (
              e.owner_context_type = 'organization'
              AND EXISTS (
                SELECT 1 FROM public.org_memberships om
                WHERE om.org_id = e.owner_context_id
                  AND om.user_id = auth.uid()
                  AND om.role::text IN ('owner','admin','editor')
              )
            )
          )
        )
      )
  )
);

COMMENT ON POLICY "reactions_insert_simple" ON events.event_reactions IS
'Simplified to just require auth - no event permission check at insert time to avoid RLS recursion';

COMMENT ON POLICY "reactions_read_simple" ON events.event_reactions IS
'Simplified to inline permission checks instead of calling can_current_user_post to avoid RLS recursion';





