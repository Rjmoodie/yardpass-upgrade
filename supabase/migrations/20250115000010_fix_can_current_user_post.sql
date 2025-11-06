-- Fix can_current_user_post to query ticketing.tickets directly instead of public.tickets view
-- The SECURITY DEFINER function was having issues with the view's RLS filtering

CREATE OR REPLACE FUNCTION public.can_current_user_post(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'ticketing', 'events'
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
                  SELECT 1 FROM public.org_memberships om
                  WHERE om.org_id = ev.owner_context_id
                    AND om.user_id = auth.uid()
                    AND om.role::text IN ('owner','admin','editor')
                )
              )
            )
        )
        OR EXISTS (
          -- Valid ticket holder check - QUERY TABLE DIRECTLY, NOT VIEW!
          SELECT 1
          FROM ticketing.tickets t
          WHERE t.event_id = p_event_id
            AND t.owner_user_id = auth.uid()
            AND t.status IN ('issued','transferred','redeemed')
        )
    END;
$function$;

COMMENT ON FUNCTION public.can_current_user_post IS 
  'Check if current user can post to event - queries ticketing.tickets table directly to avoid view RLS conflicts';

