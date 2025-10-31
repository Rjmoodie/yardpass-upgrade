-- =====================================================
-- CONVERSION TRACKING VERIFICATION SCRIPT
-- =====================================================
-- Run this after deploying conversion tracking to verify
-- all components are working correctly
-- =====================================================

\echo '🔍 Checking ad_conversions table columns...'
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'campaigns'
  AND table_name = 'ad_conversions'
ORDER BY ordinal_position;

\echo ''
\echo '🔍 Checking attribute_conversion function...'
SELECT 
  routine_name,
  routine_type,
  data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'attribute_conversion';

\echo ''
\echo '🔍 Checking track_ticket_conversion function...'
SELECT 
  routine_name,
  routine_type,
  data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'track_ticket_conversion';

\echo ''
\echo '🔍 Checking analytics_campaign_daily_mv columns...'
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'analytics_campaign_daily_mv'
  AND column_name IN ('ctr', 'cvr', 'roas', 'cpa', 'view_through_rate', 'click_conversions', 'view_conversions')
ORDER BY column_name;

\echo ''
\echo '🔍 Checking indexes on ad_conversions...'
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'campaigns'
  AND tablename = 'ad_conversions'
  AND indexname IN ('idx_ad_conversions_source', 'idx_ad_conversions_attribution_model');

\echo ''
\echo '✅ Verification complete! Check output above for any missing components.'




