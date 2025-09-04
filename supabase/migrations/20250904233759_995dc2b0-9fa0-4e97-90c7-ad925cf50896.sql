-- Fix the organization relationship hint issue
-- This resolves the "more than one relationship was found" error

-- For org_memberships table: specify which foreign key to use for organizations
CREATE OR REPLACE FUNCTION public.get_user_organizations(user_uuid uuid)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT o.id, o.name
  FROM public.organizations o
  INNER JOIN public.org_memberships om ON o.id = om.org_id
  WHERE om.user_id = user_uuid;
$$;