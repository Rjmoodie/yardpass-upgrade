-- Debug why campaign tabs are still blank
-- This will help identify the exact issue

-- 1. Check if campaigns table exists and has the right structure
SELECT '=== CAMPAIGNS TABLE STRUCTURE ===' as section;
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check campaigns data
SELECT '=== CAMPAIGNS DATA ===' as section;
SELECT 
  COUNT(*) as total_campaigns,
  COUNT(*) FILTER (WHERE status = 'active') as active_campaigns,
  COUNT(*) FILTER (WHERE status = 'draft') as draft_campaigns,
  COUNT(*) FILTER (WHERE org_id IS NOT NULL) as campaigns_with_org,
  COUNT(*) FILTER (WHERE org_id IS NULL) as campaigns_without_org
FROM campaigns;

-- 3. Check organizations data
SELECT '=== ORGANIZATIONS DATA ===' as section;
SELECT 
  COUNT(*) as total_orgs,
  COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '30 days') as recent_orgs
FROM organizations;

-- 4. Check org memberships
SELECT '=== ORG MEMBERSHIPS ===' as section;
SELECT 
  COUNT(*) as total_memberships,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT org_id) as unique_orgs
FROM org_memberships;

-- 5. Check if RPC functions exist and are callable
SELECT '=== RPC FUNCTIONS STATUS ===' as section;
SELECT 
  proname as function_name,
  CASE WHEN proname = 'rpc_campaign_analytics_daily' THEN 'EXISTS' ELSE 'OTHER' END as status
FROM pg_proc 
WHERE proname IN ('rpc_campaign_analytics_daily', 'rpc_creative_analytics_rollup')
ORDER BY proname;

-- 6. Check for any campaigns with specific org IDs
SELECT '=== SAMPLE CAMPAIGNS BY ORG ===' as section;
SELECT 
  c.org_id,
  o.name as org_name,
  COUNT(*) as campaign_count,
  STRING_AGG(c.name, ', ') as campaign_names
FROM campaigns c
LEFT JOIN organizations o ON o.id = c.org_id
GROUP BY c.org_id, o.name
ORDER BY campaign_count DESC;

-- 7. Check user access patterns
SELECT '=== USER ACCESS CHECK ===' as section;
SELECT 
  'Recent org memberships (last 30 days)' as check_type,
  COUNT(*) as count
FROM org_memberships 
WHERE created_at > now() - INTERVAL '30 days'

UNION ALL

SELECT 
  'Users with org memberships' as check_type,
  COUNT(DISTINCT user_id) as count
FROM org_memberships;

-- 8. Check for potential data issues
SELECT '=== POTENTIAL ISSUES ===' as section;

-- Check for campaigns without valid org references
SELECT 'Campaigns with invalid org_id:' as issue_type,
       COUNT(*) as count
FROM campaigns c
LEFT JOIN organizations o ON o.id = c.org_id
WHERE c.org_id IS NOT NULL AND o.id IS NULL;

-- Check for organizations without any campaigns
SELECT 'Organizations without campaigns:' as issue_type,
       COUNT(*) as count
FROM organizations o
LEFT JOIN campaigns c ON c.org_id = o.id
WHERE c.id IS NULL;

-- 9. Sample data for debugging
SELECT '=== SAMPLE DATA FOR DEBUGGING ===' as section;
SELECT 
  'Sample organizations' as data_type,
  id,
  name,
  handle,
  created_at
FROM organizations 
ORDER BY created_at DESC 
LIMIT 3

UNION ALL

SELECT 
  'Sample campaigns' as data_type,
  id,
  name,
  status,
  org_id
FROM campaigns 
ORDER BY created_at DESC 
LIMIT 3

UNION ALL

SELECT 
  'Sample org memberships' as data_type,
  user_id,
  org_id,
  role,
  created_at
FROM org_memberships 
ORDER BY created_at DESC 
LIMIT 3;
