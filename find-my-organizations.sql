-- Find organizations for datmahseh@gmail.com
-- User ID: 86289a38-799e-4e76-b3dd-2f9615e56afa

SELECT 
  o.id AS org_id,
  o.name AS org_name,
  o.logo_url,
  om.role,
  o.created_at
FROM organizations.organizations o
JOIN organizations.org_memberships om ON om.org_id = o.id
WHERE om.user_id = '86289a38-799e-4e76-b3dd-2f9615e56afa'
ORDER BY o.created_at DESC;

-- This shows all organizations you're a member of
-- Copy the org_id you want to use for the flashback event

