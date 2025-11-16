-- Add RSVP functionality for free tiers (headcount without issuing tickets)
-- This allows organizers to track interest/attendance without the overhead of ticketing

-- 1. Create event_rsvps table
CREATE TABLE IF NOT EXISTS events.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id uuid REFERENCES ticketing.ticket_tiers(id) ON DELETE SET NULL,
  guest_count integer DEFAULT 1 CHECK (guest_count > 0 AND guest_count <= 10),
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'waitlist')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Prevent duplicate RSVPs for same user/event/tier
  UNIQUE(event_id, user_id, tier_id)
);

-- 2. Add indexes for performance
CREATE INDEX idx_event_rsvps_event_id ON events.event_rsvps(event_id);
CREATE INDEX idx_event_rsvps_user_id ON events.event_rsvps(user_id);
CREATE INDEX idx_event_rsvps_status ON events.event_rsvps(status);
CREATE INDEX idx_event_rsvps_created_at ON events.event_rsvps(created_at DESC);

-- 3. Add trigger to update updated_at
CREATE OR REPLACE FUNCTION events.update_rsvp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_event_rsvps_updated_at
  BEFORE UPDATE ON events.event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION events.update_rsvp_updated_at();

-- 4. Add is_rsvp_only flag to ticket_tiers to mark RSVP-only tiers
ALTER TABLE ticketing.ticket_tiers 
ADD COLUMN IF NOT EXISTS is_rsvp_only boolean DEFAULT false;

COMMENT ON COLUMN ticketing.ticket_tiers.is_rsvp_only IS 
'If true, this is an RSVP-only tier (no tickets issued, just headcount tracking). Typically used for free tiers.';

-- 5. Enable RLS on event_rsvps
ALTER TABLE events.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Users can view RSVPs for events they can access
CREATE POLICY event_rsvps_select ON events.event_rsvps
FOR SELECT USING (
  -- Public events
  EXISTS (
    SELECT 1 FROM events.events e
    WHERE e.id = event_rsvps.event_id
      AND e.visibility = 'public'
  )
  -- Or events user can manage
  OR public.is_event_manager(event_id)
  -- Or user's own RSVPs
  OR user_id = auth.uid()
);

-- Users can create their own RSVPs
CREATE POLICY event_rsvps_insert ON events.event_rsvps
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM events.events e
    WHERE e.id = event_rsvps.event_id
      AND e.visibility IN ('public', 'unlisted')
  )
);

-- Users can update/cancel their own RSVPs
CREATE POLICY event_rsvps_update ON events.event_rsvps
FOR UPDATE USING (
  user_id = auth.uid()
  OR public.is_event_manager(event_id)
);

-- Users can delete their own RSVPs
CREATE POLICY event_rsvps_delete ON events.event_rsvps
FOR DELETE USING (
  user_id = auth.uid()
  OR public.is_event_manager(event_id)
);

-- 6. Create view for easy access
CREATE OR REPLACE VIEW public.event_rsvps AS
SELECT * FROM events.event_rsvps;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;
GRANT SELECT ON public.event_rsvps TO anon;

-- 7. Create helper function to get RSVP count for an event
CREATE OR REPLACE FUNCTION public.get_event_rsvp_count(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(guest_count), 0)::integer
  FROM events.event_rsvps
  WHERE event_id = p_event_id
    AND status = 'confirmed';
$$;

GRANT EXECUTE ON FUNCTION public.get_event_rsvp_count(uuid) TO anon, authenticated;

COMMENT ON TABLE events.event_rsvps IS 'RSVPs for events with free/RSVP-only tiers. Tracks headcount without issuing tickets.';
COMMENT ON FUNCTION public.get_event_rsvp_count(uuid) IS 'Get total confirmed RSVP count (including guests) for an event';







