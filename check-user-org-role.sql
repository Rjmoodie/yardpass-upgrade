-- Check your user's organization membership and role
SELECT 
  om.org_id,
  o.name as org_name,
  om.user_id,
  om.role,
  om.created_at,
  up.display_name as user_name
FROM organizations.org_memberships om
JOIN organizations.organizations o ON o.id = om.org_id
LEFT JOIN public.user_profiles up ON up.user_id = om.user_id
WHERE om.user_id = auth.uid()
ORDER BY om.created_at DESC;

