-- Create function to handle organization creation with membership in a single transaction
CREATE OR REPLACE FUNCTION public.create_organization_with_membership(
  p_name text,
  p_handle text,
  p_logo_url text DEFAULT NULL,
  p_creator_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  -- Insert organization
  INSERT INTO public.organizations (name, handle, logo_url, created_by, verification_status)
  VALUES (p_name, p_handle, p_logo_url, p_creator_id, 'none')
  RETURNING id INTO v_org_id;
  
  -- Insert membership for creator as owner
  INSERT INTO public.org_memberships (org_id, user_id, role)
  VALUES (v_org_id, p_creator_id, 'owner');
  
  RETURN v_org_id;
END;
$$;