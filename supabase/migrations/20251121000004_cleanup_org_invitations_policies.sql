-- ============================================================
-- CLEANUP: Organization Invitations RLS Policies
-- ============================================================
-- Removes duplicate policies and fixes security issues
-- ============================================================

-- Drop ALL existing policies (clean slate)
DROP POLICY IF EXISTS "Users can view invitations for their orgs" ON organizations.org_invitations;
DROP POLICY IF EXISTS "Org admins can create invitations" ON organizations.org_invitations;
DROP POLICY IF EXISTS "Org admins can update invitations" ON organizations.org_invitations;
DROP POLICY IF EXISTS "Org admins can delete invitations" ON organizations.org_invitations;
DROP POLICY IF EXISTS "org_members_can_view_invitations" ON organizations.org_invitations;
DROP POLICY IF EXISTS "org_admins_can_create_invitations" ON organizations.org_invitations;
DROP POLICY IF EXISTS "org_admins_can_update_invitations" ON organizations.org_invitations;
DROP POLICY IF EXISTS "anyone_can_read_by_token" ON organizations.org_invitations;

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
    FROM public.org_members 
    WHERE user_id = auth.uid()
  )
);

-- Policy 2: Public can view pending non-expired invitations
-- This is for the acceptance flow - token acts as authorization
CREATE POLICY "public_can_view_pending_invitations"
ON organizations.org_invitations
FOR SELECT
TO authenticated, anon
USING (
  status = 'pending' 
  AND expires_at > now()
);

-- ============================================================
-- INSERT Policies (Who can CREATE invitations)
-- ============================================================

-- Policy 3: Org admins and owners can create invitations
CREATE POLICY "org_admins_can_create_invitations"
ON organizations.org_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  org_id IN (
    SELECT org_id 
    FROM public.org_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- ============================================================
-- UPDATE Policies (Who can MODIFY invitations)
-- ============================================================

-- Policy 4: Org admins can update invitations (e.g., revoke)
CREATE POLICY "org_admins_can_update_invitations"
ON organizations.org_invitations
FOR UPDATE
TO authenticated
USING (
  org_id IN (
    SELECT org_id 
    FROM public.org_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- ============================================================
-- DELETE Policies (Who can REMOVE invitations)
-- ============================================================

-- Policy 5: Org admins can delete invitations
CREATE POLICY "org_admins_can_delete_invitations"
ON organizations.org_invitations
FOR DELETE
TO authenticated
USING (
  org_id IN (
    SELECT org_id 
    FROM public.org_members 
    WHERE user_id = auth.uid() 
    AND role IN ('owner', 'admin')
  )
);

-- ============================================================
-- Add Comments for Documentation
-- ============================================================

COMMENT ON POLICY "org_members_can_view_invitations" ON organizations.org_invitations IS 
  'Org members can view all invitations for their organizations';

COMMENT ON POLICY "public_can_view_pending_invitations" ON organizations.org_invitations IS 
  'Public can view pending non-expired invitations. Token acts as authorization (magic link model). Required for acceptance flow.';

COMMENT ON POLICY "org_admins_can_create_invitations" ON organizations.org_invitations IS 
  'Only org owners and admins can create new invitations';

COMMENT ON POLICY "org_admins_can_update_invitations" ON organizations.org_invitations IS 
  'Only org owners and admins can update invitations (e.g., revoke, update email status)';

COMMENT ON POLICY "org_admins_can_delete_invitations" ON organizations.org_invitations IS 
  'Only org owners and admins can delete invitations';

