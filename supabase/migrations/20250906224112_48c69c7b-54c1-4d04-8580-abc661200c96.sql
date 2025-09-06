-- Fix recursive RLS policy issues

-- First, let's check for issues in the can_current_user_post function
-- The issue might be in the overloaded function definitions

-- Drop the problematic overloaded function that takes uid parameter
DROP FUNCTION IF EXISTS public.can_current_user_post(uuid, uuid);

-- Keep only the simpler version that uses auth.uid() internally
-- The function signature should match what's being called

-- Also fix any potential recursion in helper functions
CREATE OR REPLACE FUNCTION public.get_current_user_org_role(p_org_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role::text
  FROM public.org_memberships m
  WHERE m.org_id = p_org_id
    AND m.user_id = auth.uid()
  LIMIT 1;
$$;

-- Ensure is_org_role doesn't cause recursion
CREATE OR REPLACE FUNCTION public.is_org_role(p_org_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships m
    WHERE m.org_id = p_org_id
      AND m.user_id = auth.uid()
      AND m.role::text = ANY(p_roles)
  );
$$;

-- Fix the main can_current_user_post function to avoid recursion
CREATE OR REPLACE FUNCTION public.can_current_user_post(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    EXISTS (
      -- Direct event ownership check
      SELECT 1
      FROM public.events ev
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
      -- Valid ticket holder check
      SELECT 1
      FROM public.tickets t
      WHERE t.event_id = p_event_id
        AND t.owner_user_id = auth.uid()
        AND t.status::text IN ('issued','transferred','redeemed')
    );
$$;