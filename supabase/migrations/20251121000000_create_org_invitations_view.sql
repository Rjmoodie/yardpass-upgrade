-- ============================================================
-- Create Public View for org_invitations
-- ============================================================
-- Purpose: Expose organizations.org_invitations table via public schema view
--          for PostgREST API access from edge functions
-- ============================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.org_invitations CASCADE;

-- Create the public view pointing to organizations.org_invitations
CREATE VIEW public.org_invitations AS
SELECT * FROM organizations.org_invitations;

COMMENT ON VIEW public.org_invitations IS 'Public view of organizations.org_invitations for API access';

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_invitations TO authenticated;
GRANT SELECT ON public.org_invitations TO anon;

-- Enable RLS on the underlying table (if not already enabled)
ALTER TABLE organizations.org_invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist

-- Policy: Users can view invitations for organizations they belong to
DO $$ 
BEGIN
  -- Drop old policy if exists
  DROP POLICY IF EXISTS "Users can view invitations for their orgs" ON organizations.org_invitations;
  
  -- Create new policy using public.org_members view
  CREATE POLICY "Users can view invitations for their orgs"
  ON organizations.org_invitations
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id 
      FROM public.org_members 
      WHERE user_id = auth.uid()
    )
  );
END $$;

-- Policy: Org admins can create invitations
DO $$ 
BEGIN
  -- Drop old policy if exists
  DROP POLICY IF EXISTS "Org admins can create invitations" ON organizations.org_invitations;
  
  -- Create new policy using public.org_members view
  CREATE POLICY "Org admins can create invitations"
  ON organizations.org_invitations
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id 
      FROM public.org_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );
END $$;

-- Policy: Org admins can update invitations
DO $$ 
BEGIN
  -- Drop old policy if exists
  DROP POLICY IF EXISTS "Org admins can update invitations" ON organizations.org_invitations;
  
  -- Create new policy using public.org_members view
  CREATE POLICY "Org admins can update invitations"
  ON organizations.org_invitations
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id 
      FROM public.org_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );
END $$;

-- Policy: Org admins can delete invitations
DO $$ 
BEGIN
  -- Drop old policy if exists
  DROP POLICY IF EXISTS "Org admins can delete invitations" ON organizations.org_invitations;
  
  -- Create new policy using public.org_members view
  CREATE POLICY "Org admins can delete invitations"
  ON organizations.org_invitations
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id 
      FROM public.org_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );
END $$;

