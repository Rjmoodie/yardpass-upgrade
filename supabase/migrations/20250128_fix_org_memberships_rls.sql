-- ============================================================================
-- CRITICAL SECURITY FIX: Enable RLS on organizations.org_memberships
-- ============================================================================
-- This table was found to have RLS disabled during security audit.
-- This is CRITICAL as it controls organization access.
-- ============================================================================

-- Enable RLS
ALTER TABLE organizations.org_memberships ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can see their own memberships
CREATE POLICY "users_see_own_memberships"
ON organizations.org_memberships
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy 2: Users can see memberships for organizations they belong to
-- (so organizers can see who else is in their org)
CREATE POLICY "org_members_see_org_memberships"
ON organizations.org_memberships
FOR SELECT
TO authenticated
USING (
    org_id IN (
        SELECT om2.org_id
        FROM organizations.org_memberships om2
        WHERE om2.user_id = auth.uid()
    )
);

-- Policy 3: Public/anonymous cannot see memberships
-- (No policy for anon = deny all)

-- Policy 4: Only service_role can insert/update/delete
-- (Membership changes should go through Edge Functions or admin functions)
-- We'll create a specific policy for org admins/owners to manage memberships
CREATE POLICY "org_admins_manage_memberships"
ON organizations.org_memberships
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM organizations.org_memberships om
        WHERE om.org_id = organizations.org_memberships.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM organizations.org_memberships om
        WHERE om.org_id = organizations.org_memberships.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
);

-- Allow service_role to do everything (bypasses RLS anyway, but explicit)
-- Service role already bypasses RLS, but we document this

COMMENT ON POLICY "users_see_own_memberships" ON organizations.org_memberships IS
'Users can see their own organization memberships';

COMMENT ON POLICY "org_members_see_org_memberships" ON organizations.org_memberships IS
'Users can see memberships for organizations they belong to';

COMMENT ON POLICY "org_admins_manage_memberships" ON organizations.org_memberships IS
'Organization owners and admins can manage memberships in their organizations';

-- Verify RLS is enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'organizations'
        AND tablename = 'org_memberships'
        AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'RLS failed to enable on organizations.org_memberships';
    END IF;
    RAISE NOTICE '✅ RLS enabled on organizations.org_memberships';
END $$;


