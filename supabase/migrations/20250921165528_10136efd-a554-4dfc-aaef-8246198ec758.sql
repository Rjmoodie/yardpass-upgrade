-- Drop and recreate get_user_organizations with verification status
DROP FUNCTION public.get_user_organizations(uuid);

CREATE OR REPLACE FUNCTION public.get_user_organizations(user_uuid uuid)
RETURNS TABLE(id uuid, name text, verification_status verification_status, is_verified boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT o.id, o.name, o.verification_status, o.is_verified
  FROM public.organizations o
  INNER JOIN public.org_memberships om ON o.id = om.org_id
  WHERE om.user_id = user_uuid;
$$;