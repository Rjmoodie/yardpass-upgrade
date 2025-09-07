-- Drop conflicting read policies and create a single comprehensive one
DROP POLICY IF EXISTS "events_public_read" ON events;
DROP POLICY IF EXISTS "events_read_creator" ON events;
DROP POLICY IF EXISTS "events_read_individual_owner" ON events;
DROP POLICY IF EXISTS "events_read_org_member" ON events;
DROP POLICY IF EXISTS "events_read_public" ON events;
DROP POLICY IF EXISTS "events_read_public_or_manager" ON events;
DROP POLICY IF EXISTS "events_read_ticket_holder" ON events;

-- Create a single, clear policy for reading events
CREATE POLICY "events_read_access" ON events FOR SELECT USING (
  -- Public events can be seen by anyone
  visibility = 'public'
  -- OR user is authenticated and it's unlisted
  OR (auth.role() = 'authenticated' AND visibility = 'unlisted')
  -- OR user is the creator/owner
  OR (auth.uid() IS NOT NULL AND created_by = auth.uid())
  -- OR user is individual owner
  OR (auth.uid() IS NOT NULL AND owner_context_type = 'individual' AND owner_context_id = auth.uid())
  -- OR user is org member
  OR (auth.uid() IS NOT NULL AND owner_context_type = 'organization' AND EXISTS (
    SELECT 1 FROM org_memberships m 
    WHERE m.org_id = events.owner_context_id 
    AND m.user_id = auth.uid()
  ))
  -- OR user has a ticket to the event
  OR (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM tickets t 
    WHERE t.event_id = events.id 
    AND t.owner_user_id = auth.uid() 
    AND t.status IN ('issued', 'transferred', 'redeemed')
  ))
);