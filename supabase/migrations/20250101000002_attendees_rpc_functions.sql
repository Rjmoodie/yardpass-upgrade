-- RPC functions for perfect attendee uniqueness and counting
-- These provide server-side deduplication and accurate counts

-- Unique attendees (server-side dedupe) with stable paging and ticket counts
CREATE OR REPLACE FUNCTION public.get_event_attendees(
  p_event  uuid,
  p_limit  int  DEFAULT 60,
  p_offset int  DEFAULT 0
)
RETURNS TABLE (
  user_id     uuid,
  display_name text,
  photo_url    text,
  joined_at    timestamptz,
  ticket_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
WITH per_user AS (
  SELECT
    t.owner_user_id AS user_id,
    MIN(t.created_at) AS joined_at,
    COUNT(*) AS ticket_count
  FROM tickets t
  WHERE t.event_id = p_event
    AND t.status IN ('issued','transferred','redeemed')
  GROUP BY t.owner_user_id
)
SELECT
  pu.user_id,
  up.display_name,
  up.photo_url,
  pu.joined_at,
  pu.ticket_count
FROM per_user pu
JOIN user_profiles up ON up.user_id = pu.user_id
ORDER BY pu.joined_at DESC, pu.user_id  -- stable order + tiebreaker
LIMIT p_limit OFFSET p_offset;
$$;

-- Accurate unique attendee count
CREATE OR REPLACE FUNCTION public.count_event_attendees(p_event uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT owner_user_id)
  FROM tickets
  WHERE event_id = p_event
    AND status IN ('issued','transferred','redeemed');
$$;

-- Performance indexes tuned for these RPCs

-- Supports GROUP BY(owner_user_id) + MIN(created_at) + COUNT(*)
CREATE INDEX IF NOT EXISTS idx_tickets_evt_status_owner_created
  ON tickets (event_id, status, owner_user_id, created_at DESC);

-- Supports COUNT(DISTINCT owner_user_id) efficiently
CREATE INDEX IF NOT EXISTS idx_tickets_evt_status_owner
  ON tickets (event_id, status, owner_user_id);

-- Event slug lookup (already good)
CREATE INDEX IF NOT EXISTS idx_events_slug ON events (slug);

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_event_attendees(uuid, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_event_attendees(uuid) TO authenticated;e 