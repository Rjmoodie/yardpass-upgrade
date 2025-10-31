-- =====================================================
-- QUICK CONVERSION TRACKING TEST
-- =====================================================

\echo '✅ TESTING CONVERSION TRACKING DEPLOYMENT'
\echo ''

-- 1. Check materialized view columns
\echo '1️⃣ New metrics columns:'
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'analytics_campaign_daily_mv'
  AND column_name IN ('ctr', 'cvr', 'cpa', 'roas', 'click_conversions', 'view_conversions', 'view_through_rate')
ORDER BY column_name;

\echo ''

-- 2. Test the materialized view query
\echo '2️⃣ Sample analytics data:'
SELECT 
  campaign_id,
  day,
  impressions,
  clicks,
  conversions,
  spend_credits,
  ctr,
  cvr,
  cpa,
  roas,
  click_conversions,
  view_conversions
FROM public.analytics_campaign_daily_mv
WHERE day >= CURRENT_DATE - 7
ORDER BY day DESC
LIMIT 5;

\echo ''

-- 3. Refresh analytics
\echo '3️⃣ Refreshing analytics...'
SELECT public.refresh_analytics();

\echo ''

-- 4. Check after refresh
\echo '4️⃣ Post-refresh data:'
SELECT 
  campaign_id,
  impressions,
  clicks,
  conversions,
  spend_credits,
  ctr,
  cvr
FROM public.analytics_campaign_daily_mv
WHERE day >= CURRENT_DATE - 7
ORDER BY day DESC
LIMIT 3;

\echo ''
\echo '✅ ALL TESTS COMPLETE!'
\echo ''
\echo '📚 Next Steps:'
\echo '   1. Read: CONVERSION_TRACKING_INTEGRATION.md'
\echo '   2. Add to checkout: trackTicketPurchase()'
\echo '   3. Test: CONVERSION_TRACKING_TESTING_GUIDE.md'



