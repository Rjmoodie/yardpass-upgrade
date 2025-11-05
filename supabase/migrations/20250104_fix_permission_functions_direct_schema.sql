-- Fix permission functions to query events.events directly, not through public.events view
-- This prevents RLS recursion even with SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.can_current_user_post(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'events', 'public', 'ticketing', 'users'
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
          -- Direct event ownership check (using events.events directly)
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
                  SELECT 1 FROM public.org_memberships om
                  WHERE om.org_id = ev.owner_context_id
                    AND om.user_id = auth.uid()
                    AND om.role::text IN ('owner','admin','editor')
                )
              )
            )
        )
        OR EXISTS (
          -- Valid ticket holder check (using ticketing.tickets directly)
          SELECT 1
          FROM ticketing.tickets t
          WHERE t.event_id = p_event_id
            AND t.owner_user_id = auth.uid()
            AND t.status::text IN ('issued','transferred','redeemed')
        )
    END;
$function$;

CREATE OR REPLACE FUNCTION public.can_post_to_flashback(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'events', 'public'
AS $function$
  SELECT
    auth.role() = 'authenticated'::text
    AND EXISTS (
      SELECT 1
      FROM events.events e
      WHERE e.id = p_event_id
        AND e.is_flashback = true
        AND e.flashback_end_at > now()
    );
$function$;

COMMENT ON FUNCTION public.can_current_user_post IS
'Queries events.events directly (not via public.events view) to prevent RLS recursion. Uses SECURITY DEFINER to bypass RLS.';

COMMENT ON FUNCTION public.can_post_to_flashback IS
'Queries events.events directly (not via public.events view) to prevent RLS recursion. Uses SECURITY DEFINER to bypass RLS.';





