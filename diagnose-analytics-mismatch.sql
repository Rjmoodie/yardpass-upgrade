-- =====================================================
-- DIAGNOSE ANALYTICS MISMATCH
-- =====================================================

\echo '🔍 Checking raw data vs materialized view...'
\echo ''

-- 1. Check raw impressions
\echo '1️⃣ Raw impressions (last 7 days):'
SELECT 
  campaign_id,
  DATE(created_at AT TIME ZONE 'UTC') AS day,
  COUNT(*) AS impressions,
  created_at AS sample_timestamp
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY campaign_id, DATE(created_at AT TIME ZONE 'UTC'), created_at
ORDER BY created_at DESC
LIMIT 5;

\echo ''

-- 2. Check raw clicks
\echo '2️⃣ Raw clicks (last 7 days):'
SELECT 
  campaign_id,
  DATE(created_at AT TIME ZONE 'UTC') AS day,
  COUNT(*) AS clicks,
  created_at AS sample_timestamp
FROM campaigns.ad_clicks
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY campaign_id, DATE(created_at AT TIME ZONE 'UTC'), created_at
ORDER BY created_at DESC
LIMIT 5;

\echo ''

-- 3. Check raw spend ledger
\echo '3️⃣ Raw spend ledger (last 7 days):'
SELECT 
  campaign_id,
  DATE(occurred_at AT TIME ZONE 'UTC') AS day,
  SUM(credits_charged) AS total_spend,
  COUNT(*) AS num_entries,
  occurred_at AS sample_timestamp
FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
  AND occurred_at >= NOW() - INTERVAL '7 days'
GROUP BY campaign_id, DATE(occurred_at AT TIME ZONE 'UTC'), occurred_at
ORDER BY occurred_at DESC
LIMIT 5;

\echo ''

-- 4. Check campaign date range
\echo '4️⃣ Campaign date range:'
SELECT 
  id,
  name,
  start_date,
  end_date,
  CURRENT_DATE AS today,
  CASE 
    WHEN start_date IS NULL THEN 'No start_date set!'
    WHEN start_date > CURRENT_DATE THEN 'Campaign not started yet'
    WHEN end_date IS NOT NULL AND end_date < CURRENT_DATE THEN 'Campaign ended'
    ELSE 'Active'
  END AS status
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

\echo ''

-- 5. Check what's in the materialized view
\echo '5️⃣ Materialized view data:'
SELECT 
  campaign_id,
  day,
  impressions,
  clicks,
  conversions,
  spend_credits
FROM public.analytics_campaign_daily_mv
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC
LIMIT 5;

\echo ''

-- 6. Check util.calendar_day for this campaign
\echo '6️⃣ Calendar days generated for campaign:'
SELECT 
  c.id AS campaign_id,
  c.start_date,
  c.end_date,
  d.day,
  CASE 
    WHEN d.day < c.start_date THEN 'Before start'
    WHEN d.day > COALESCE(c.end_date, CURRENT_DATE + INTERVAL '1 year') THEN 'After end'
    ELSE 'In range'
  END AS day_status
FROM campaigns.campaigns c
CROSS JOIN util.calendar_day d
WHERE c.id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
  AND d.day >= CURRENT_DATE - 7
  AND d.day <= CURRENT_DATE
ORDER BY d.day DESC
LIMIT 10;

\echo ''
\echo '✅ DIAGNOSIS COMPLETE - Check output above!'


