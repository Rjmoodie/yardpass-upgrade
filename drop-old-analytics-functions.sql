-- Drop old analytics functions if they exist

DROP FUNCTION IF EXISTS public.rpc_campaign_analytics_daily CASCADE;
DROP FUNCTION IF EXISTS public.rpc_creative_analytics_rollup CASCADE;

-- Confirm they're gone
SELECT 'Old analytics functions dropped' as status;

