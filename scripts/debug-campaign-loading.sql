-- Debug Campaign Loading Issues
-- This script checks why Campaigns and Analytics tabs aren't loading

-- 1. Check if campaigns table exists and has data
SELECT '=== CAMPAIGNS TABLE STATUS ===' as section;
SELECT 
  COUNT(*) as total_campaigns,
  COUNT(*) FILTER (WHERE status = 'active') as active_campaigns,
  COUNT(*) FILTER (WHERE status = 'draft') as draft_campaigns,
  COUNT(*) FILTER (WHERE org_id IS NOT NULL) as campaigns_with_org,
  COUNT(*) FILTER (WHERE org_id IS NULL) as campaigns_without_org
FROM campaigns;

-- 2. Check organization context for campaigns
SELECT '=== ORGANIZATION CONTEXT ===' as section;
SELECT 
  c.id as campaign_id,
  c.name as campaign_name,
  c.status,
  c.org_id,
  o.name as org_name,
  o.handle as org_handle,
  CASE 
    WHEN o.id IS NULL THEN 'MISSING_ORG'
    ELSE 'ORG_EXISTS'
  END as org_status
FROM campaigns c
LEFT JOIN organizations o ON o.id = c.org_id
ORDER BY c.created_at DESC
LIMIT 10;

-- 3. Check user organizations and memberships
SELECT '=== USER ORGANIZATIONS ===' as section;
SELECT 
  up.display_name as user_name,
  o.name as org_name,
  o.handle as org_handle,
  om.role,
  om.created_at as membership_date
FROM user_profiles up
JOIN org_memberships om ON om.user_id = up.user_id
JOIN organizations o ON o.id = om.org_id
WHERE om.role IN ('owner', 'admin', 'editor')
ORDER BY om.created_at DESC
LIMIT 10;

-- 4. Check campaign analytics data availability
SELECT '=== CAMPAIGN ANALYTICS DATA ===' as section;
SELECT 
  c.id as campaign_id,
  c.name as campaign_name,
  c.status,
  c.total_budget_credits,
  c.spent_credits,
  c.org_id,
  -- Check if we have any related analytics tables
  (SELECT COUNT(*) FROM campaign_analytics WHERE campaign_id = c.id) as analytics_count,
  (SELECT COUNT(*) FROM creative_performance WHERE campaign_id = c.id) as creative_count
FROM campaigns c
ORDER BY c.created_at DESC
LIMIT 5;

-- 5. Check for missing foreign key relationships
SELECT '=== FOREIGN KEY ISSUES ===' as section;

-- Campaigns without valid organizations
SELECT 'Campaigns without valid orgs:' as issue_type,
       COUNT(*) as count
FROM campaigns c
LEFT JOIN organizations o ON o.id = c.org_id
WHERE o.id IS NULL;

-- Organizations without any campaigns
SELECT 'Orgs without campaigns:' as issue_type,
       COUNT(*) as count
FROM organizations o
LEFT JOIN campaigns c ON c.org_id = o.id
WHERE c.id IS NULL;

-- 6. Check recent campaign creation activity
SELECT '=== RECENT ACTIVITY ===' as section;
SELECT 
  'Campaigns created last 30 days' as activity_type,
  COUNT(*) as count
FROM campaigns 
WHERE created_at > now() - INTERVAL '30 days'

UNION ALL

SELECT 
  'Organizations created last 30 days' as activity_type,
  COUNT(*) as count
FROM organizations 
WHERE created_at > now() - INTERVAL '30 days'

UNION ALL

SELECT 
  'Org memberships created last 30 days' as activity_type,
  COUNT(*) as count
FROM org_memberships 
WHERE created_at > now() - INTERVAL '30 days';

-- 7. Check for potential RLS (Row Level Security) issues
SELECT '=== RLS POLICY CHECK ===' as section;
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename IN ('campaigns', 'organizations', 'org_memberships')
ORDER BY tablename, policyname;

-- 8. Sample data for testing
SELECT '=== SAMPLE DATA FOR TESTING ===' as section;
SELECT 
  'Sample organizations' as data_type,
  id,
  name,
  handle,
  created_by
FROM organizations 
LIMIT 3

UNION ALL

SELECT 
  'Sample campaigns' as data_type,
  id,
  name,
  status,
  org_id
FROM campaigns 
LIMIT 3;
