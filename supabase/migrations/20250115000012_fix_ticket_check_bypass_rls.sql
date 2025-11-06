-- Create a helper function that bypasses RLS to check if user has valid tickets
-- This is needed because can_current_user_post (SECURITY DEFINER) was being blocked by RLS on ticketing.tickets

CREATE OR REPLACE FUNCTION public.user_has_valid_ticket(p_user_id uuid, p_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  ticket_exists boolean;
BEGIN
  -- Query ticketing.tickets directly as the function owner (bypasses RLS)
  SELECT EXISTS (
    SELECT 1 
    FROM ticketing.tickets
    WHERE event_id = p_event_id
      AND owner_user_id = p_user_id
      AND status IN ('issued', 'transferred', 'redeemed')
  ) INTO ticket_exists;
  
  RETURN ticket_exists;
END;
$$;

COMMENT ON FUNCTION public.user_has_valid_ticket IS 
  'Check if user has valid ticket for event - bypasses RLS for permission checks';

GRANT EXECUTE ON FUNCTION public.user_has_valid_ticket TO authenticated, anon;

-- Now update can_current_user_post to use this helper
CREATE OR REPLACE FUNCTION public.can_current_user_post(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'events'
AS $function$
  SELECT
    -- Check if this is a flashback event
    CASE 
      WHEN (SELECT is_flashback FROM events.events WHERE id = p_event_id) = true THEN
        -- Flashback rules: Any authenticated user (no ticket required!)
        public.can_post_to_flashback(p_event_id)
      ELSE
        -- Regular event rules: Organizer OR ticket holder
        EXISTS (
          -- Direct event ownership check
          SELECT 1
          FROM events.events ev
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
                  SELECT 1 FROM organizations.org_memberships om
                  WHERE om.org_id = ev.owner_context_id
                    AND om.user_id = auth.uid()
                    AND om.role::text IN ('owner','admin','editor')
                )
              )
            )
        )
        OR public.user_has_valid_ticket(auth.uid(), p_event_id)
    END;
$function$;

COMMENT ON FUNCTION public.can_current_user_post IS 
  'Check if current user can post to event - uses RLS-bypassing ticket check';

