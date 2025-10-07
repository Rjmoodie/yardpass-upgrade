-- Debug Campaign Components and Organization User Flow
-- This script analyzes the campaign system and organization flow

-- 1. Check Organizations Table Structure
SELECT '=== ORGANIZATIONS TABLE ===' as section;
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'organizations' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check Campaigns Table Structure
SELECT '=== CAMPAIGNS TABLE ===' as section;
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check Org Memberships Table Structure
SELECT '=== ORG_MEMBERSHIPS TABLE ===' as section;
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'org_memberships' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Sample Organizations Data
SELECT '=== SAMPLE ORGANIZATIONS ===' as section;
SELECT 
  id,
  name,
  handle,
  created_by,
  created_at,
  verification_status,
  CASE 
    WHEN logo_url IS NOT NULL THEN 'Has Logo'
    ELSE 'No Logo'
  END as logo_status
FROM organizations 
ORDER BY created_at DESC 
LIMIT 10;

-- 5. Sample Campaigns Data
SELECT '=== SAMPLE CAMPAIGNS ===' as section;
SELECT 
  c.id,
  c.name,
  c.status,
  c.objective,
  c.total_budget_credits,
  c.spent_credits,
  c.start_date,
  c.end_date,
  c.org_id,
  o.name as org_name
FROM campaigns c
LEFT JOIN organizations o ON o.id = c.org_id
ORDER BY c.created_at DESC 
LIMIT 10;

-- 6. Organization Memberships
SELECT '=== ORG MEMBERSHIPS ===' as section;
SELECT 
  om.user_id,
  om.role,
  om.created_at as membership_created,
  up.display_name as user_name,
  o.name as org_name,
  o.handle as org_handle
FROM org_memberships om
JOIN organizations o ON o.id = om.org_id
LEFT JOIN user_profiles up ON up.user_id = om.user_id
ORDER BY om.created_at DESC 
LIMIT 15;

-- 7. Campaign Creation Flow Analysis
SELECT '=== CAMPAIGN CREATION FLOW ===' as section;
SELECT 
  COUNT(*) as total_campaigns,
  COUNT(*) FILTER (WHERE status = 'draft') as draft_campaigns,
  COUNT(*) FILTER (WHERE status = 'active') as active_campaigns,
  COUNT(*) FILTER (WHERE status = 'paused') as paused_campaigns,
  COUNT(*) FILTER (WHERE status = 'archived') as archived_campaigns,
  COUNT(*) FILTER (WHERE org_id IS NOT NULL) as org_campaigns,
  COUNT(*) FILTER (WHERE org_id IS NULL) as orphaned_campaigns
FROM campaigns;

-- 8. Organization-Campaign Relationship Health
SELECT '=== ORG-CAMPAIGN RELATIONSHIPS ===' as section;
SELECT 
  o.id as org_id,
  o.name as org_name,
  o.handle,
  COUNT(c.id) as campaign_count,
  COUNT(c.id) FILTER (WHERE c.status = 'active') as active_campaigns,
  COUNT(om.user_id) as team_members
FROM organizations o
LEFT JOIN campaigns c ON c.org_id = o.id
LEFT JOIN org_memberships om ON om.org_id = o.id
GROUP BY o.id, o.name, o.handle
ORDER BY campaign_count DESC;

-- 9. User Role Analysis in Organizations
SELECT '=== USER ROLES IN ORGS ===' as section;
SELECT 
  role,
  COUNT(*) as user_count,
  COUNT(DISTINCT org_id) as org_count
FROM org_memberships
GROUP BY role
ORDER BY user_count DESC;

-- 10. Campaign Objectives Analysis
SELECT '=== CAMPAIGN OBJECTIVES ===' as section;
SELECT 
  objective,
  COUNT(*) as campaign_count,
  AVG(total_budget_credits) as avg_budget,
  SUM(spent_credits) as total_spent
FROM campaigns
GROUP BY objective
ORDER BY campaign_count DESC;

-- 11. Potential Issues Check
SELECT '=== POTENTIAL ISSUES ===' as section;

-- Check for campaigns without organizations
SELECT 'Campaigns without valid organizations:' as issue_type,
       COUNT(*) as count
FROM campaigns c
LEFT JOIN organizations o ON o.id = c.org_id
WHERE o.id IS NULL;

-- Check for organizations without campaigns
SELECT 'Organizations without campaigns:' as issue_type,
       COUNT(*) as count
FROM organizations o
LEFT JOIN campaigns c ON c.org_id = o.id
WHERE c.id IS NULL;

-- Check for users without organization memberships
SELECT 'Users without org memberships:' as issue_type,
       COUNT(*) as count
FROM user_profiles up
LEFT JOIN org_memberships om ON om.user_id = up.user_id
WHERE om.user_id IS NULL;

-- Check for invalid campaign statuses
SELECT 'Invalid campaign statuses:' as issue_type,
       status,
       COUNT(*) as count
FROM campaigns
WHERE status NOT IN ('draft', 'active', 'paused', 'archived')
GROUP BY status;

-- 12. Recent Activity
SELECT '=== RECENT ACTIVITY ===' as section;
SELECT 
  'Organizations created' as activity_type,
  COUNT(*) as count
FROM organizations 
WHERE created_at > now() - INTERVAL '7 days'

UNION ALL

SELECT 
  'Campaigns created' as activity_type,
  COUNT(*) as count
FROM campaigns 
WHERE created_at > now() - INTERVAL '7 days'

UNION ALL

SELECT 
  'Memberships created' as activity_type,
  COUNT(*) as count
FROM org_memberships 
WHERE created_at > now() - INTERVAL '7 days';
