-- ===================================================================
-- FIX: Move Analytics Views from campaigns to public Schema
-- ===================================================================
-- This fixes the 404 errors by moving views to public schema
-- where Supabase PostgREST API can access them
-- ===================================================================

BEGIN;

-- Drop old views from campaigns schema (if they exist)
DROP VIEW IF EXISTS campaigns.analytics_campaign_daily CASCADE;
DROP VIEW IF EXISTS campaigns.analytics_creative_daily CASCADE;
DROP VIEW IF EXISTS campaigns.analytics_viewability_campaign CASCADE;
DROP VIEW IF EXISTS campaigns.analytics_attribution_campaign CASCADE;
DROP MATERIALIZED VIEW IF EXISTS campaigns.analytics_campaign_daily_mv CASCADE;
DROP FUNCTION IF EXISTS campaigns.refresh_analytics() CASCADE;

-- Now redeploy the corrected migration
\i supabase/migrations/20251027000000_analytics_v2_views.sql

COMMIT;

-- Verify views are in public schema
SELECT 
  schemaname, 
  viewname 
FROM pg_views 
WHERE viewname LIKE 'analytics_%';

SELECT 
  schemaname, 
  matviewname 
FROM pg_matviews 
WHERE matviewname LIKE 'analytics_%';

SELECT 'Views successfully moved to public schema!' AS status;



