-- =====================================================
-- FINAL DEPLOYMENT VERIFICATION
-- =====================================================

\echo '✅ CHECKING ALL COMPONENTS...'
\echo ''

-- 1. Check new columns
\echo '1️⃣ New ad_conversions columns:'
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'campaigns'
  AND table_name = 'ad_conversions'
  AND column_name IN ('attribution_model', 'conversion_source', 'device_type', 'user_agent', 'referrer')
ORDER BY column_name;

\echo ''

-- 2. Check functions
\echo '2️⃣ Enhanced functions:'
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('attribute_conversion', 'track_ticket_conversion')
ORDER BY routine_name;

\echo ''

-- 3. Check materialized view has new metrics
\echo '3️⃣ New analytics metrics:'
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'analytics_campaign_daily_mv'
  AND column_name IN ('ctr', 'cvr', 'cpa', 'roas', 'click_conversions', 'view_conversions', 'view_through_rate')
ORDER BY column_name;

\echo ''

-- 4. Check materialized view has data
\echo '4️⃣ Analytics data (last 7 days):'
SELECT 
  campaign_id,
  day,
  impressions,
  clicks,
  conversions,
  ctr,
  cvr,
  CASE WHEN conversions > 0 THEN cpa ELSE 0 END AS cpa,
  CASE WHEN conversions > 0 THEN roas ELSE 0 END AS roas
FROM public.analytics_campaign_daily_mv
WHERE day >= CURRENT_DATE - 7
ORDER BY day DESC, campaign_id
LIMIT 10;

\echo ''
\echo '✅ DEPLOYMENT VERIFICATION COMPLETE!'

