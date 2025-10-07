-- Quick check for campaign loading issues
-- Run this to see what's in your database

-- 1. Check if we have any organizations
SELECT 'Organizations count:' as check_type, COUNT(*) as count FROM organizations;

-- 2. Check if we have any campaigns  
SELECT 'Campaigns count:' as check_type, COUNT(*) as count FROM campaigns;

-- 3. Check if we have any org memberships
SELECT 'Org memberships count:' as check_type, COUNT(*) as count FROM org_memberships;

-- 4. Check if the RPC functions exist
SELECT 'RPC functions:' as check_type, 
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc 
         WHERE proname = 'rpc_campaign_analytics_daily'
       ) THEN 'EXISTS' ELSE 'MISSING' END as campaign_analytics_rpc;

SELECT 'Creative RPC functions:' as check_type,
       CASE WHEN EXISTS (
         SELECT 1 FROM pg_proc 
         WHERE proname = 'rpc_creative_analytics_rollup'
       ) THEN 'EXISTS' ELSE 'MISSING' END as creative_analytics_rpc;

-- 5. Sample data
SELECT 'Sample organizations:' as check_type, 
       id, name, handle, created_at 
FROM organizations 
ORDER BY created_at DESC 
LIMIT 3;

SELECT 'Sample campaigns:' as check_type,
       id, name, status, org_id, created_at
FROM campaigns 
ORDER BY created_at DESC 
LIMIT 3;
