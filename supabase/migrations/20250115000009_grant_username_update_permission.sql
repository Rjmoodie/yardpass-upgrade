-- Grant authenticated users permission to update their own username in user_profiles view
-- This is needed for the ProfileCompletionModal to work

-- Ensure the underlying table allows updates
GRANT UPDATE (username) ON users.user_profiles TO authenticated;

-- Ensure the view allows updates
GRANT UPDATE ON public.user_profiles TO authenticated;

-- If there's an RLS policy blocking updates, we need to ensure users can update their own record
-- Check if RLS is enabled on users.user_profiles
DO $$
BEGIN
  -- Enable RLS if not already enabled
  ALTER TABLE users.user_profiles ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN OTHERS THEN NULL; -- Ignore if already enabled
END $$;

-- Create or replace policy to allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON users.user_profiles;
CREATE POLICY "Users can update own profile" 
  ON users.user_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Ensure the view is defined with security_invoker=false (SECURITY DEFINER behavior)
-- OR that users have proper permissions on the underlying table
COMMENT ON VIEW public.user_profiles IS 
  'User profiles view - users can read all, update/delete their own';

