-- Find all active organizations and their members

-- QUERY 1: All organizations with member details
SELECT 
  o.id AS org_id,
  o.name AS org_name,
  o.logo_url,
  o.verification_status,
  o.created_at AS org_created,
  -- Member details
  om.user_id AS member_user_id,
  om.role AS member_role,
  u.email AS member_email,
  up.display_name AS member_name
FROM organizations.organizations o
LEFT JOIN organizations.org_memberships om ON om.org_id = o.id
LEFT JOIN auth.users u ON u.id = om.user_id
LEFT JOIN users.user_profiles up ON up.user_id = om.user_id
ORDER BY o.created_at DESC, om.role;

-- QUERY 2: Organizations for specific user (datmahseh@gmail.com)
SELECT 
  o.id AS org_id,
  o.name AS org_name,
  om.role AS your_role,
  o.verification_status,
  (SELECT COUNT(*) FROM organizations.org_memberships WHERE org_id = o.id) AS total_members
FROM organizations.organizations o
JOIN organizations.org_memberships om ON om.org_id = o.id
WHERE om.user_id = '86289a38-799e-4e76-b3dd-2f9615e56afa'
ORDER BY o.created_at DESC;

-- QUERY 3: All organizations (no filters)
SELECT 
  id,
  name,
  logo_url,
  verification_status,
  created_at,
  (SELECT COUNT(*) FROM organizations.org_memberships WHERE org_id = organizations.id) AS member_count,
  (SELECT COUNT(*) FROM events.events WHERE owner_context_type = 'organization' AND owner_context_id = organizations.id) AS event_count
FROM organizations.organizations
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- INTERPRETATION:
-- ============================================================================
-- If Query 1 or 2 returns "No rows":
--   → No organizations exist yet OR datmahseh is not a member
--
-- If Query 3 shows organizations:
--   → Organizations exist, but datmahseh is not a member
--   → Need to create org membership first
--
-- If all return "No rows":
--   → Need to create an organization first

