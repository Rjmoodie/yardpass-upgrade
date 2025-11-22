-- Fix event_invites RLS: Ensure is_event_manager has SECURITY DEFINER
-- Problem: 403 errors when querying event_invites, likely due to is_event_manager
-- not having proper SECURITY DEFINER when called from RLS policies

-- Ensure is_event_manager has SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_event_manager(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog, events, organizations
AS $$
  SELECT public.is_event_individual_owner(p_event_id)
      OR public.is_event_org_editor(p_event_id);
$$;

COMMENT ON FUNCTION public.is_event_manager IS 
  'Check if current user is an event manager (individual owner or org editor/admin/owner). SECURITY DEFINER required for RLS policy use.';

-- Verify RLS is enabled on events.event_invites
ALTER TABLE events.event_invites ENABLE ROW LEVEL SECURITY;

-- Ensure the public view exists and is properly configured
DROP VIEW IF EXISTS public.event_invites CASCADE;

CREATE VIEW public.event_invites AS
SELECT * FROM events.event_invites;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_invites TO authenticated;
GRANT SELECT ON public.event_invites TO anon;

-- Set security invoker (view uses caller's permissions, not definer's)
ALTER VIEW public.event_invites SET (security_invoker = true);

COMMENT ON VIEW public.event_invites IS 
  'Public view for event_invites table. Uses RLS policies from events.event_invites.';

-- Drop and recreate RLS policies to ensure they're correct
DROP POLICY IF EXISTS "event_invites_manage_by_manager" ON events.event_invites;
DROP POLICY IF EXISTS "event_invites_select_own" ON events.event_invites;
DROP POLICY IF EXISTS "event_invites_manage_creator" ON events.event_invites;
DROP POLICY IF EXISTS "event_invites_manage_individual_owner" ON events.event_invites;
DROP POLICY IF EXISTS "event_invites_manage_org_admin" ON events.event_invites;
DROP POLICY IF EXISTS "invited can read own" ON events.event_invites;

-- Policy 1: Event managers can manage all invites (SELECT, INSERT, UPDATE, DELETE)
-- This must be FOR ALL (not just SELECT) to handle all operations
CREATE POLICY "event_invites_manage_by_manager"
ON events.event_invites
FOR ALL
TO authenticated
USING (
  public.is_event_manager(event_id)
)
WITH CHECK (
  public.is_event_manager(event_id)
);

-- Policy 2: Users can view invites sent to them (SELECT only)
-- This allows users to see invites addressed to their email or user_id
CREATE POLICY "event_invites_select_own"
ON events.event_invites
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Add comments
COMMENT ON POLICY "event_invites_manage_by_manager" ON events.event_invites IS
  'Event managers can manage all invites for their events (SELECT, INSERT, UPDATE, DELETE)';

COMMENT ON POLICY "event_invites_select_own" ON events.event_invites IS
  'Users can view invites sent to their email or user_id';

