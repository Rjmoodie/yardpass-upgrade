-- Fix infinite recursion in org_memberships RLS policies
-- The problem: policies query org_memberships from within org_memberships policies

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

-- Step 2: Create simple, non-recursive policies
-- Policy 1: Users can view their own memberships
CREATE POLICY "Users can view their own memberships"
  ON organizations.org_memberships
  FOR SELECT
  TO public
  USING (user_id = auth.uid());

-- Policy 2: Admins can manage memberships (using a function that doesn't recurse)
-- For now, we'll use a simpler approach that checks if the user owns the org
CREATE POLICY "Org owners can manage memberships"
  ON organizations.org_memberships
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM organizations.organizations o
      WHERE o.id = org_memberships.org_id
      AND o.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizations.organizations o
      WHERE o.id = org_memberships.org_id
      AND o.owner_id = auth.uid()
    )
  );

-- Verify the new policies
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

