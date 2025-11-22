-- ============================================================
-- Create Public View for Organizations Table
-- ============================================================
-- Purpose: Expose organizations.organizations table via public schema view
--          for PostgREST API access from frontend
-- ============================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.organizations CASCADE;

-- Create the public view pointing to organizations.organizations
CREATE VIEW public.organizations AS
SELECT * FROM organizations.organizations;

COMMENT ON VIEW public.organizations IS 'Public view of organizations.organizations for API access';

-- Grant access
GRANT SELECT ON public.organizations TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.organizations TO authenticated;

-- Enable RLS on the underlying table (if not already enabled)
ALTER TABLE organizations.organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies for organizations.organizations
-- ============================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "public_can_view_organizations" ON organizations.organizations;
DROP POLICY IF EXISTS "members_can_view_their_orgs" ON organizations.organizations;
DROP POLICY IF EXISTS "authenticated_can_create_orgs" ON organizations.organizations;
DROP POLICY IF EXISTS "org_members_can_update" ON organizations.organizations;
DROP POLICY IF EXISTS "org_admins_can_update" ON organizations.organizations;
DROP POLICY IF EXISTS "org_owners_can_update" ON organizations.organizations;

-- Policy 1: Public can view organizations (for public profiles)
CREATE POLICY "public_can_view_organizations"
ON organizations.organizations
FOR SELECT
TO authenticated, anon
USING (true);

-- Policy 2: Org members can view their organizations (redundant but explicit)
CREATE POLICY "members_can_view_their_orgs"
ON organizations.organizations
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT org_id 
    FROM organizations.org_memberships 
    WHERE user_id = auth.uid()
  )
);

-- Policy 3: Authenticated users can create organizations
CREATE POLICY "authenticated_can_create_orgs"
ON organizations.organizations
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
);

-- Policy 4: Org members can update their organizations (basic fields)
-- This allows members to update non-sensitive fields
CREATE POLICY "org_members_can_update"
ON organizations.organizations
FOR UPDATE
TO authenticated
USING (
  id IN (
    SELECT org_id 
    FROM organizations.org_memberships 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  id IN (
    SELECT org_id 
    FROM organizations.org_memberships 
    WHERE user_id = auth.uid()
  )
);

-- Policy 5: Org admins and owners can update sensitive fields
-- This is handled by the same policy as members, but can be extended
-- if we need separate admin-only fields (like verification_status, etc.)

-- Grant schema usage if needed
GRANT USAGE ON SCHEMA organizations TO authenticated, anon;

-- ============================================================
-- Migration Complete
-- ============================================================
-- The public.organizations view is now accessible from the frontend
-- with proper RLS policies allowing:
-- - Public read access (for public profiles)
-- - Authenticated users can create orgs
-- - Org members can update their orgs

