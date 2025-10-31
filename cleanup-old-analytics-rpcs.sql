-- ===================================================================
-- CLEANUP: Remove Old Analytics RPC Functions
-- ===================================================================
-- These RPCs are replaced by V2 views which are faster and cleaner
-- Run this AFTER deploying V2 views and updating frontend
-- ===================================================================

BEGIN;

-- Drop old analytics RPCs (keep billing RPCs!)
DROP FUNCTION IF EXISTS public.rpc_campaign_analytics_daily(uuid, text, text, uuid[]) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_creative_analytics_rollup(uuid, text, text, uuid[], uuid[], boolean, text, text, integer, integer) CASCADE;
DROP FUNCTION IF EXISTS public.rpc_creative_analytics_daily(uuid, text, text, uuid[], uuid[]) CASCADE;

-- Verify they're gone
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname LIKE 'rpc_%analytics%'
  ) THEN
    RAISE WARNING 'Some analytics RPCs still exist - check pg_proc';
  ELSE
    RAISE NOTICE '✅ All old analytics RPCs removed successfully';
  END IF;
END $$;

COMMIT;

-- ===================================================================
-- Cleanup Complete
-- ===================================================================
-- Removed:
--   - rpc_campaign_analytics_daily
--   - rpc_creative_analytics_rollup
--   - rpc_creative_analytics_daily
--
-- Kept (still needed for billing):
--   - log_impression_and_charge
--   - log_click_and_charge
--   - attribute_conversion
--   - refresh_analytics (new V2 function)
-- ===================================================================



