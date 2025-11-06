-- Add SECURITY DEFINER to permission helper functions
-- These are called by RLS policies and need SECURITY DEFINER to bypass RLS on tables they query

-- Fix is_event_individual_owner
CREATE OR REPLACE FUNCTION public.is_event_individual_owner(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'events'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM events.events e
    WHERE e.id = p_event_id
      AND e.owner_context_type = 'individual'
      AND e.owner_context_id = auth.uid()
  );
$function$;

-- Fix is_event_org_editor
CREATE OR REPLACE FUNCTION public.is_event_org_editor(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'events', 'organizations'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM events.events e
    WHERE e.id = p_event_id
      AND e.owner_context_type = 'organization'
      AND public.is_org_role(e.owner_context_id, ARRAY['editor','admin','owner'])
  );
$function$;

-- Also check and fix is_org_role if needed
CREATE OR REPLACE FUNCTION public.is_org_role(p_org_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog', 'organizations'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM organizations.org_memberships om
    WHERE om.org_id = p_org_id
      AND om.user_id = auth.uid()
      AND om.role::text = ANY(p_roles)
  );
$function$;

COMMENT ON FUNCTION public.is_event_individual_owner IS 'Check if user is individual owner of event - SECURITY DEFINER for RLS policy use';
COMMENT ON FUNCTION public.is_event_org_editor IS 'Check if user is org editor/admin/owner - SECURITY DEFINER for RLS policy use';
COMMENT ON FUNCTION public.is_org_role IS 'Check if user has specific org role - SECURITY DEFINER for RLS policy use';

