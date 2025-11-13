-- =====================================================================
-- FIX AUDIENCE INTELLIGENCE PERMISSIONS & POSTGREST RELOAD
-- =====================================================================
-- Issue: PostgREST needs to reload schema cache after new functions
-- Fix: Add anon grants and notify PostgREST
-- =====================================================================

-- Ensure anon role can execute audience functions
GRANT EXECUTE ON FUNCTION public.get_audience_overview TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_audience_acquisition TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_audience_device_network TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_audience_cohorts TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_audience_paths TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_high_intent_visitors TO anon, authenticated, service_role;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

COMMENT ON FUNCTION public.get_audience_overview IS 
  'Returns audience overview metrics. Accessible to anon, authenticated, service_role.';

COMMENT ON FUNCTION public.get_audience_acquisition IS 
  'Returns acquisition quality by channel. Accessible to anon, authenticated, service_role.';

COMMENT ON FUNCTION public.get_audience_device_network IS 
  'Returns device and network performance. Accessible to anon, authenticated, service_role.';

COMMENT ON FUNCTION public.get_audience_cohorts IS 
  'Returns cohort retention analysis. Accessible to anon, authenticated, service_role.';

COMMENT ON FUNCTION public.get_audience_paths IS 
  'Returns top user pathways to purchase. Accessible to anon, authenticated, service_role.';

COMMENT ON FUNCTION public.get_high_intent_visitors IS 
  'Returns high-intent visitors (propensity score ≥ threshold). Accessible to anon, authenticated, service_role.';

