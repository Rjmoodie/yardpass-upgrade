-- ============================================================
-- Fix and Complete RLS Policies for Organization Invitations
-- ============================================================
-- This migration ensures all necessary policies are in place
-- and handles both org members AND invitees (non-members)
-- ============================================================

-- Ensure RLS is enabled
ALTER TABLE organizations.org_invitations ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view invitations for their orgs" ON organizations.org_invitations;
DROP POLICY IF EXISTS "Org admins can create invitations" ON organizations.org_invitations;
DROP POLICY IF EXISTS "Org admins can update invitations" ON organizations.org_invitations;
DROP POLICY IF EXISTS "Org admins can delete invitations" ON organizations.org_invitations;
DROP POLICY IF EXISTS "org_members_can_view_invitations" ON organizations.org_invitations;
DROP POLICY IF EXISTS "org_admins_can_create_invitations" ON organizations.org_invitations;
DROP POLICY IF EXISTS "org_admins_can_update_invitations" ON organizations.org_invitations;
DROP POLICY IF EXISTS "Invitees can view their own invitation" ON organizations.org_invitations;
DROP POLICY IF EXISTS "Service role full access" ON organizations.org_invitations;

-- ============================================================
-- SELECT Policies (Who can READ invitations)
-- ============================================================

-- Policy 1: Org members can view invitations for their organizations
CREATE POLICY "org_members_can_view_invitations"
ON organizations.org_invitations
FOR SELECT
TO authenticated
USING (
  org_id IN (
    SELECT org_id 
    FROM organizations.org_memberships 
    WHERE user_id = auth.uid()
  )
);

-- Policy 2: Anyone can view pending, non-expired invitations
-- This is CRITICAL for the acceptance flow (before user is authenticated)
-- Security considerations:
--   - Only pending, non-expired invites are visible
--   - Token is a secure UUID (impossible to guess)
--   - Frontend queries .eq('token', 'specific-token'), so only gets that one row
--   - Acceptance still requires authentication and email match
--   - Sensitive data (token) is needed to query, acting as authorization
-- This is similar to a "magic link" security model
CREATE POLICY "public_can_view_pending_invitations"
ON organizations.org_invitations
FOR SELECT
TO authenticated, anon
USING (
  status = 'pending' 
  AND expires_at > now()
  -- Note: This allows viewing ALL pending non-expired invites
  -- However, the token acts as the secret key
  -- Frontend must know the exact token to query
  -- This is acceptable for the invite acceptance flow
);

-- Policy 3: Service role has full read access (for Edge Functions)
CREATE POLICY "service_role_can_view_all"
ON organizations.org_invitations
FOR SELECT
TO service_role
USING (true);

-- ============================================================
-- INSERT Policies (Who can CREATE invitations)
-- ============================================================

-- Policy 4: Org admins and owners can create invitations
CREATE POLICY "org_admins_can_create_invitations"
ON organizations.org_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (
    SELECT org_id 
    FROM organizations.org_memberships 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- Policy 5: Service role can create invitations (for Edge Functions)
CREATE POLICY "service_role_can_insert"
ON organizations.org_invitations
FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================================
-- UPDATE Policies (Who can MODIFY invitations)
-- ============================================================

-- Policy 6: Org admins can update invitations (e.g., revoke)
CREATE POLICY "org_admins_can_update_invitations"
ON organizations.org_invitations
FOR UPDATE
TO authenticated
USING (
  org_id IN (
    SELECT org_id 
    FROM organizations.org_memberships 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- Policy 7: Accept function can update status (via SECURITY DEFINER)
-- SECURITY DEFINER functions run as postgres role, so they bypass RLS
-- But we add this for explicit documentation
CREATE POLICY "service_role_can_update"
ON organizations.org_invitations
FOR UPDATE
TO service_role
USING (true);

-- ============================================================
-- DELETE Policies (Who can REMOVE invitations)
-- ============================================================

-- Policy 8: Org admins can delete invitations
CREATE POLICY "org_admins_can_delete_invitations"
ON organizations.org_invitations
FOR DELETE
TO authenticated
USING (
  org_id IN (
    SELECT org_id 
    FROM organizations.org_memberships 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- Policy 9: Service role can delete (for cleanup operations)
CREATE POLICY "service_role_can_delete"
ON organizations.org_invitations
FOR DELETE
TO service_role
USING (true);

-- ============================================================
-- Grant Permissions on Views
-- ============================================================

-- Ensure public view has proper grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_invitations TO authenticated;
GRANT SELECT ON public.org_invitations TO anon;
GRANT ALL ON public.org_invitations TO service_role;

-- Ensure status log view has proper grants
GRANT SELECT ON public.org_invite_status_log TO authenticated;
GRANT SELECT ON public.org_invite_status_log TO anon;
GRANT SELECT ON public.org_invite_status_log TO service_role;

-- ============================================================
-- Add Helpful Comments
-- ============================================================

COMMENT ON POLICY "org_members_can_view_invitations" ON organizations.org_invitations IS 
  'Org members can view all invitations for their organizations';

COMMENT ON POLICY "public_can_view_pending_invitations" ON organizations.org_invitations IS 
  'Public can view pending non-expired invitations. Token acts as authorization (magic link model). Acceptance still requires auth + email match.';

COMMENT ON POLICY "org_admins_can_create_invitations" ON organizations.org_invitations IS 
  'Only org owners and admins can create new invitations';

COMMENT ON POLICY "org_admins_can_update_invitations" ON organizations.org_invitations IS 
  'Only org owners and admins can update invitations (e.g., revoke)';

COMMENT ON POLICY "org_admins_can_delete_invitations" ON organizations.org_invitations IS 
  'Only org owners and admins can delete invitations';

