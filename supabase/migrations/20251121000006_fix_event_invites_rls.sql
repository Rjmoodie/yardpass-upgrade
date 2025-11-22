-- Fix event_invites RLS policies to allow INSERT operations
-- Problem: Existing policies only have USING clauses, which don't apply to INSERT

-- Drop existing policies
DROP POLICY IF EXISTS "event_invites_manage_creator" ON events.event_invites;
DROP POLICY IF EXISTS "event_invites_manage_individual_owner" ON events.event_invites;
DROP POLICY IF EXISTS "event_invites_manage_org_admin" ON events.event_invites;
DROP POLICY IF EXISTS "invited can read own" ON events.event_invites;

-- Policy 1: Event managers can manage all invites (SELECT, INSERT, UPDATE, DELETE)
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

-- Policy 2: Users can view invites sent to them
CREATE POLICY "event_invites_select_own"
ON events.event_invites
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Comment
COMMENT ON POLICY "event_invites_manage_by_manager" ON events.event_invites IS
  'Event managers can manage all invites for their events';

COMMENT ON POLICY "event_invites_select_own" ON events.event_invites IS
  'Users can view invites sent to their email or user_id';

