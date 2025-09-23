-- Fix infinite recursion in sponsor_members policies
-- Drop existing policies that might cause recursion
DROP POLICY IF EXISTS "Users can view their own sponsor memberships" ON sponsor_members;
DROP POLICY IF EXISTS "Users can insert their own sponsor memberships" ON sponsor_members;
DROP POLICY IF EXISTS "Users can update their own sponsor memberships" ON sponsor_members;
DROP POLICY IF EXISTS "Users can delete their own sponsor memberships" ON sponsor_members;
DROP POLICY IF EXISTS "Sponsor owners can manage members" ON sponsor_members;

-- Create simple, non-recursive policies
CREATE POLICY "Users can view sponsor memberships"
ON sponsor_members FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert sponsor memberships"
ON sponsor_members FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update sponsor memberships"
ON sponsor_members FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can delete sponsor memberships"
ON sponsor_members FOR DELETE
USING (user_id = auth.uid());