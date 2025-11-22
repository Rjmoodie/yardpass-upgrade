-- Fix create_organization_with_membership function
-- Problem: Function inserts into public.org_memberships (VIEW) instead of organizations.org_memberships (TABLE)

-- Drop existing function
DROP FUNCTION IF EXISTS public.create_organization_with_membership(text, text, text, uuid);

-- Recreate with correct table reference
CREATE OR REPLACE FUNCTION public.create_organization_with_membership(
  p_name text,
  p_handle text,
  p_logo_url text DEFAULT NULL,
  p_creator_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'organizations'
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Insert organization
  INSERT INTO organizations.organizations (name, handle, logo_url, created_by, verification_status)
  VALUES (p_name, p_handle, p_logo_url, p_creator_id, 'none')
  RETURNING id INTO v_org_id;
  
  -- Insert membership for creator as owner (use actual table, not view)
  INSERT INTO organizations.org_memberships (org_id, user_id, role)
  VALUES (v_org_id, p_creator_id, 'owner');
  
  RETURN v_org_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create organization with membership: %', SQLERRM;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_organization_with_membership(text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_with_membership(text, text, text, uuid) TO anon;

-- Comment
COMMENT ON FUNCTION public.create_organization_with_membership IS 
  'Atomically creates an organization and adds the creator as an owner member. Returns the organization ID.';

