-- Add visibility and link token columns to events
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public','unlisted','private'));

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS link_token text;

-- Create invite list for private events
CREATE TABLE IF NOT EXISTS event_invites (
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text,
  role text DEFAULT 'viewer',
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- Enable RLS
ALTER TABLE event_invites ENABLE ROW LEVEL SECURITY;

-- Anyone can read public events (already exists but ensuring it covers visibility)
DROP POLICY IF EXISTS "read public events" ON events;
CREATE POLICY "read public events" ON events
  FOR SELECT USING (visibility = 'public');

-- Organizers can read their events
DROP POLICY IF EXISTS "read organizer events" ON events;
CREATE POLICY "read organizer events" ON events
  FOR SELECT USING (
    created_by = auth.uid()
    OR (owner_context_type = 'individual' AND owner_context_id = auth.uid())
    OR (owner_context_type = 'organization' AND EXISTS (
      SELECT 1 FROM org_memberships m
      WHERE m.org_id = events.owner_context_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin','editor')
    ))
  );

-- Invited users can read private events
CREATE POLICY "read private invited" ON events
  FOR SELECT USING (
    visibility = 'private'
    AND EXISTS (
      SELECT 1 FROM event_invites i
      WHERE i.event_id = events.id
        AND i.user_id = auth.uid()
    )
  );

-- Ticket holders can read private events
CREATE POLICY "read private ticket holders" ON events
  FOR SELECT USING (
    visibility = 'private'
    AND EXISTS (
      SELECT 1 FROM tickets t
      WHERE t.event_id = events.id
        AND t.owner_user_id = auth.uid()
        AND t.status IN ('issued','transferred','redeemed')
    )
  );

-- Event invites policies - organizers can manage
CREATE POLICY "invites organizer manage" ON event_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_invites.event_id
        AND (
          e.created_by = auth.uid()
          OR (e.owner_context_type = 'individual' AND e.owner_context_id = auth.uid())
          OR (e.owner_context_type = 'organization' AND EXISTS (
            SELECT 1 FROM org_memberships m
            WHERE m.org_id = e.owner_context_id
              AND m.user_id = auth.uid()
              AND m.role IN ('owner','admin','editor')
          ))
        )
    )
  );

-- Invited users can read their own invites
CREATE POLICY "invited can read own" ON event_invites
  FOR SELECT USING (user_id = auth.uid());