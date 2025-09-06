-- Fix infinite recursion in events RLS policies
-- Drop problematic policies that might cause recursion
DROP POLICY IF EXISTS "read public events" ON events;
DROP POLICY IF EXISTS "read organizer events" ON events;
DROP POLICY IF EXISTS "read private invited" ON events;
DROP POLICY IF EXISTS "read private ticket holders" ON events;

-- Create simple, non-recursive policies
CREATE POLICY "events_read_public" ON events
  FOR SELECT USING (visibility = 'public');

CREATE POLICY "events_read_creator" ON events
  FOR SELECT USING (created_by = auth.uid());

CREATE POLICY "events_read_individual_owner" ON events
  FOR SELECT USING (
    owner_context_type = 'individual' 
    AND owner_context_id = auth.uid()
  );

CREATE POLICY "events_read_org_member" ON events
  FOR SELECT USING (
    owner_context_type = 'organization'
    AND EXISTS (
      SELECT 1 FROM org_memberships m
      WHERE m.org_id = events.owner_context_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin','editor','viewer')
    )
  );

CREATE POLICY "events_read_ticket_holder" ON events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.event_id = events.id
        AND t.owner_user_id = auth.uid()
        AND t.status IN ('issued','transferred','redeemed')
    )
  );

-- Also fix the event_invites policy that might have issues
DROP POLICY IF EXISTS "invites organizer manage" ON event_invites;

CREATE POLICY "event_invites_manage_creator" ON event_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_invites.event_id
        AND e.created_by = auth.uid()
    )
  );

CREATE POLICY "event_invites_manage_individual_owner" ON event_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_invites.event_id
        AND e.owner_context_type = 'individual'
        AND e.owner_context_id = auth.uid()
    )
  );

CREATE POLICY "event_invites_manage_org_admin" ON event_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      JOIN org_memberships m ON m.org_id = e.owner_context_id
      WHERE e.id = event_invites.event_id
        AND e.owner_context_type = 'organization'
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin','editor')
    )
  );