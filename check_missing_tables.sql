-- ============================================================
-- YardPass Database Diagnostic: Check Missing Tables & Schemas
-- ============================================================
-- Run this in your Supabase SQL Editor to see what's missing
-- ============================================================

-- 1. Check if schemas exist
-- ============================================================
SELECT 
  'messaging' AS schema_name,
  EXISTS (
    SELECT 1 FROM information_schema.schemata 
    WHERE schema_name = 'messaging'
  ) AS exists
UNION ALL
SELECT 
  'organizations',
  EXISTS (
    SELECT 1 FROM information_schema.schemata 
    WHERE schema_name = 'organizations'
  )
UNION ALL
SELECT 
  'campaigns',
  EXISTS (
    SELECT 1 FROM information_schema.schemata 
    WHERE schema_name = 'campaigns'
  );

-- 2. Check if specific tables exist
-- ============================================================
SELECT 
  'messaging.message_jobs' AS table_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'messaging' 
    AND table_name = 'message_jobs'
  ) AS exists
UNION ALL
SELECT 
  'messaging.message_job_recipients',
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'messaging' 
    AND table_name = 'message_job_recipients'
  )
UNION ALL
SELECT 
  'organizations.org_contact_imports',
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'organizations' 
    AND table_name = 'org_contact_imports'
  )
UNION ALL
SELECT 
  'organizations.org_contact_import_entries',
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'organizations' 
    AND table_name = 'org_contact_import_entries'
  )
UNION ALL
SELECT 
  'campaigns.credit_packages',
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'campaigns' 
    AND table_name = 'credit_packages'
  )
UNION ALL
SELECT 
  'campaigns.ad_creatives',
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'campaigns' 
    AND table_name = 'ad_creatives'
  )
UNION ALL
SELECT 
  'campaigns.campaigns',
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'campaigns' 
    AND table_name = 'campaigns'
  )
UNION ALL
SELECT 
  'campaigns.ad_impressions',
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'campaigns' 
    AND table_name = 'ad_impressions'
  )
UNION ALL
SELECT 
  'campaigns.ad_clicks',
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'campaigns' 
    AND table_name = 'ad_clicks'
  );

-- 3. Check if RPC functions exist
-- ============================================================
SELECT 
  'public.rpc_creative_analytics_rollup' AS function_name,
  EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name = 'rpc_creative_analytics_rollup'
  ) AS exists;

-- 4. Check what tables ARE in public schema (for comparison)
-- ============================================================
SELECT 
  'PUBLIC SCHEMA TABLES' AS info,
  string_agg(table_name, ', ' ORDER BY table_name) AS tables_available
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE';

-- 5. Summary: What's missing?
-- ============================================================
WITH missing_items AS (
  SELECT 'Schema: messaging' AS item, 
         NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'messaging') AS is_missing
  UNION ALL
  SELECT 'Schema: organizations',
         NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'organizations')
  UNION ALL
  SELECT 'Schema: campaigns',
         NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'campaigns')
  UNION ALL
  SELECT 'Table: messaging.message_jobs',
         NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'messaging' AND table_name = 'message_jobs')
  UNION ALL
  SELECT 'Table: organizations.org_contact_imports',
         NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'organizations' AND table_name = 'org_contact_imports')
  UNION ALL
  SELECT 'Table: campaigns.credit_packages',
         NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'campaigns' AND table_name = 'credit_packages')
  UNION ALL
  SELECT 'Table: campaigns.ad_creatives',
         NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'campaigns' AND table_name = 'ad_creatives')
  UNION ALL
  SELECT 'Function: public.rpc_creative_analytics_rollup',
         NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name = 'rpc_creative_analytics_rollup')
)
SELECT 
  '🔴 MISSING ITEMS' AS status,
  item
FROM missing_items
WHERE is_missing = true

UNION ALL

SELECT 
  '✅ AVAILABLE ITEMS' AS status,
  item
FROM missing_items
WHERE is_missing = false
ORDER BY status DESC, item;

