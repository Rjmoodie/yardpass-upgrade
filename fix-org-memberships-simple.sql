-- Fix infinite recursion in org_memberships RLS policies
-- Simple approach: Just allow users to see their own memberships

-- Step 1: Drop ALL existing policies on org_memberships
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'organizations' 
        AND tablename = 'org_memberships'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON organizations.org_memberships', pol.policyname);
    END LOOP;
END $$;

-- Step 2: Create ONE simple, non-recursive policy
-- Users can only view their own memberships (no subqueries to org_memberships)
CREATE POLICY "simple_user_memberships"
  ON organizations.org_memberships
  FOR ALL
  TO public
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Verify the new policy
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

