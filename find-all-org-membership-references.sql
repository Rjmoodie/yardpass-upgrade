-- Find ALL policies across ALL tables that reference org_memberships
-- This will help us identify the circular dependency

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE 
  qual LIKE '%org_memberships%' 
  OR with_check LIKE '%org_memberships%'
ORDER BY schemaname, tablename, policyname;

