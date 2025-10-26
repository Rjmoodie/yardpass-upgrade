-- ============================================================
-- Create Public View for org_members (alias for org_memberships)
-- ============================================================
-- Purpose: Expose organizations.org_memberships table via public schema view
--          as org_members for PostgREST API access from edge functions
-- ============================================================

-- Drop existing views if they exist
DROP VIEW IF EXISTS public.org_members CASCADE;
DROP VIEW IF EXISTS public.org_memberships CASCADE;

-- Create the public view org_members pointing to organizations.org_memberships
-- Only include columns that actually exist in the table
CREATE VIEW public.org_members AS
SELECT 
  org_id,
  user_id,
  role,
  created_at
FROM organizations.org_memberships;

COMMENT ON VIEW public.org_members IS 'Public view of organizations.org_memberships for API access (aliased as org_members)';

-- Also create org_memberships view for backwards compatibility
CREATE VIEW public.org_memberships AS
SELECT * FROM public.org_members;

COMMENT ON VIEW public.org_memberships IS 'Alias for org_members view';

-- Grant access
GRANT SELECT ON public.org_members TO authenticated;
GRANT SELECT ON public.org_members TO anon;
GRANT SELECT ON public.org_memberships TO authenticated;
GRANT SELECT ON public.org_memberships TO anon;

-- Enable RLS on the underlying table (if not already enabled)
ALTER TABLE organizations.org_memberships ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist

-- Policy: Users can view memberships for organizations they belong to
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'org_memberships' 
    AND policyname = 'Users can view org memberships'
    AND schemaname = 'organizations'
  ) THEN
    CREATE POLICY "Users can view org memberships"
      ON organizations.org_memberships
      FOR SELECT
      USING (
        org_id IN (
          SELECT org_id FROM organizations.org_memberships 
          WHERE user_id = auth.uid()
        )
        OR user_id = auth.uid()
      );
  END IF;
END $$;

-- Create indexes if they don't exist for better query performance
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id_user_id 
  ON organizations.org_memberships(org_id, user_id);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id 
  ON organizations.org_memberships(user_id);


