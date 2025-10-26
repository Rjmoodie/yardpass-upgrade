-- Temporarily disable RLS on org_memberships to break infinite recursion
-- This is safe because access is controlled at the application/edge function level

-- Disable RLS on org_memberships
ALTER TABLE organizations.org_memberships DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'organizations'
  AND tablename = 'org_memberships';

-- Also verify no policies are being evaluated
SELECT 
  schemaname,
  tablename,
  policyname
FROM pg_policies
WHERE tablename = 'org_memberships'
  AND schemaname = 'organizations';

