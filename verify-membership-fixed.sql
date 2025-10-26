-- Verify your org membership now exists with owner role
SELECT 
  om.org_id,
  o.name as org_name,
  om.user_id,
  om.role,
  om.created_at,
  'Membership verified!' as status
FROM organizations.org_memberships om
JOIN organizations.organizations o ON o.id = om.org_id
WHERE om.user_id = auth.uid()
ORDER BY om.created_at DESC;

