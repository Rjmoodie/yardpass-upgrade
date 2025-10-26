-- Fix infinite recursion in org_memberships RLS policies
-- The issue is that storage policies check org_memberships, 
-- and org_memberships RLS policies might be checking storage, creating a loop

-- First, let's see what policies exist on org_memberships
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'org_memberships'
  AND schemaname = 'organizations'
ORDER BY policyname;

-- Option 1: If there are circular policies, we'll need to drop and recreate them
-- without the circular reference

-- Option 2: Temporarily disable RLS on org_memberships to break the cycle
-- (This is safe because org_memberships is in the organizations schema and 
-- access is already controlled by the application layer)

-- Uncomment the following line if needed:
-- ALTER TABLE organizations.org_memberships DISABLE ROW LEVEL SECURITY;

