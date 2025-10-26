-- Drop all remaining policies on org_memberships
DROP POLICY IF EXISTS "simple_user_memberships" ON organizations.org_memberships;

-- Confirm RLS is disabled and no policies remain
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'organizations'
  AND tablename = 'org_memberships';

-- Verify no policies exist
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename = 'org_memberships'
  AND schemaname = 'organizations';

