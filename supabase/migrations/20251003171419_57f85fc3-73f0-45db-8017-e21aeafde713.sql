-- Drop ambiguous overload of rpc_creative_analytics_rollup that uses text for dates
-- This ensures Supabase/Postgres resolves to the date-parameter version
DROP FUNCTION IF EXISTS public.rpc_creative_analytics_rollup(
  uuid, text, text, uuid[], uuid[], boolean, text, text, integer, integer
);