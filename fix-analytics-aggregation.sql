-- =====================================================
-- FIX ANALYTICS AGGREGATION ISSUES
-- =====================================================

\echo '🔧 Investigating data aggregation...'
\echo ''

-- 1. Check how many rows exist per campaign
\echo '1️⃣ Rows per campaign in materialized view:'
SELECT 
  campaign_id,
  COUNT(*) AS num_rows,
  SUM(impressions) AS total_impressions,
  SUM(clicks) AS total_clicks,
  SUM(spend_credits) AS total_spend
FROM public.analytics_campaign_daily_mv
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
GROUP BY campaign_id;

\echo ''

-- 2. Check daily breakdown
\echo '2️⃣ Daily breakdown:'
SELECT 
  day,
  impressions,
  clicks,
  spend_credits,
  avg_dwell_ms,
  ctr,
  cvr
FROM public.analytics_campaign_daily_mv
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC;

\echo ''

-- 3. Check if spend_accrual is included
\echo '3️⃣ Campaign spend status:'
SELECT 
  id,
  name,
  spent_credits,
  spend_accrual,
  spent_credits + spend_accrual AS total_spend
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

\echo ''

-- 4. Check raw impression dwell times
\echo '4️⃣ Raw impression dwell times:'
SELECT 
  campaign_id,
  COUNT(*) AS num_impressions,
  AVG(dwell_ms) AS avg_dwell_ms,
  MIN(dwell_ms) AS min_dwell_ms,
  MAX(dwell_ms) AS max_dwell_ms,
  COUNT(*) FILTER (WHERE dwell_ms > 0) AS impressions_with_dwell
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
GROUP BY campaign_id;

\echo ''

-- 5. Sample impressions
\echo '5️⃣ Sample impressions:'
SELECT 
  id,
  dwell_ms,
  viewable,
  created_at
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY created_at DESC
LIMIT 5;

\echo ''
\echo '✅ INVESTIGATION COMPLETE!'

