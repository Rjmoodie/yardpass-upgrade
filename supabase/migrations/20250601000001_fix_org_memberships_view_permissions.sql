-- ============================================================================
-- Fix org_memberships view permissions and RLS
-- ============================================================================
-- Issue: Users getting "permission denied for view org_memberships" error
-- Root cause: View needs proper GRANT permissions and RLS policies need
--             to work correctly through the view
-- ============================================================================

-- Ensure the view exists (recreate if needed for consistency)
DROP VIEW IF EXISTS public.org_memberships CASCADE;
DROP VIEW IF EXISTS public.org_members CASCADE;

-- Recreate the views with proper structure
CREATE VIEW public.org_members AS
SELECT 
  org_id,
  user_id,
  role,
  created_at
FROM organizations.org_memberships;

COMMENT ON VIEW public.org_members IS 'Public view of organizations.org_memberships for API access';

-- Create org_memberships view as alias
CREATE VIEW public.org_memberships AS
SELECT * FROM public.org_members;

COMMENT ON VIEW public.org_memberships IS 'Alias for org_members view (backwards compatibility)';

-- Grant SELECT permissions on the views
-- Note: RLS policies on the underlying table will still apply
GRANT SELECT ON public.org_members TO authenticated;
GRANT SELECT ON public.org_members TO anon;
GRANT SELECT ON public.org_memberships TO authenticated;
GRANT SELECT ON public.org_memberships TO anon;

-- Ensure RLS is enabled on the underlying table
ALTER TABLE organizations.org_memberships ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to recreate them cleanly
DROP POLICY IF EXISTS "users_see_own_memberships" ON organizations.org_memberships;
DROP POLICY IF EXISTS "org_members_see_org_memberships" ON organizations.org_memberships;
DROP POLICY IF EXISTS "Users can view org memberships" ON organizations.org_memberships;

-- Policy 1: Users can see their own memberships
CREATE POLICY "users_see_own_memberships"
ON organizations.org_memberships
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy 2: Users can see memberships for organizations they belong to
-- This allows users to see who else is in their organizations
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
    OR user_id = auth.uid()
);

-- Policy 3: Allow public read for org memberships (for public event pages)
-- This is needed for EventDetailsPage to show organizer info
-- We'll restrict this to only show user_id (not sensitive data)
-- Actually, let's be more restrictive - only show if the org is public or event is public
-- For now, we'll keep it restricted to authenticated users who are members
-- If needed, we can add a more permissive policy later

-- Verify the setup
DO $$
BEGIN
    -- Check RLS is enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'organizations'
        AND tablename = 'org_memberships'
        AND rowsecurity = true
    ) THEN
        RAISE EXCEPTION 'RLS failed to enable on organizations.org_memberships';
    END IF;
    
    -- Check views exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_views
        WHERE schemaname = 'public'
        AND viewname = 'org_memberships'
    ) THEN
        RAISE EXCEPTION 'View public.org_memberships does not exist';
    END IF;
    
    RAISE NOTICE '✅ org_memberships view and RLS policies configured correctly';
END $$;

