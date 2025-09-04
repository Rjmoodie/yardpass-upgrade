-- Fix search_path for security function 
CREATE OR REPLACE FUNCTION public.get_user_organizations(user_uuid uuid)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT o.id, o.name
  FROM public.organizations o
  INNER JOIN public.org_memberships om ON o.id = om.org_id
  WHERE om.user_id = user_uuid;
$$;