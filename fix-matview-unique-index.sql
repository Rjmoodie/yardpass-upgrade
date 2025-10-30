-- ===================================================================
-- FIX: Add UNIQUE index for concurrent materialized view refresh
-- ===================================================================
-- Run this ONLY if you already deployed the V2 migration and got the error
-- If matview doesn't exist, run the full migration first:
--   psql $DB_URL -f supabase/migrations/20251027000000_analytics_v2_views.sql
-- ===================================================================

DO $$
BEGIN
  -- Check if matview exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_matviews 
    WHERE schemaname = 'campaigns' 
    AND matviewname = 'analytics_campaign_daily_mv'
  ) THEN
    RAISE EXCEPTION 'Materialized view does not exist yet. Run the full migration first: supabase/migrations/20251027000000_analytics_v2_views.sql';
  END IF;
END $$;

BEGIN;

-- Drop the old non-unique index
DROP INDEX IF EXISTS campaigns.idx_acdmv_campaign_day;

-- Create UNIQUE index (required for CONCURRENT refresh)
CREATE UNIQUE INDEX IF NOT EXISTS idx_acdmv_campaign_day_unique
  ON campaigns.analytics_campaign_daily_mv(campaign_id, day);

-- Test the refresh
SELECT campaigns.refresh_analytics();

COMMIT;

-- ===================================================================
-- Fix Applied Successfully
-- ===================================================================

SELECT 'Fix applied! Matview can now refresh concurrently.' AS status;

