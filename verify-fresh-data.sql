-- =====================================================
-- VERIFY FRESH TEST DATA
-- =====================================================

-- 1. Check new impressions have dwell_ms > 0
SELECT 
  'Fresh Impressions' AS check_type,
  COUNT(*) AS total,
  AVG(dwell_ms) AS avg_dwell_ms,
  COUNT(*) FILTER (WHERE dwell_ms > 0) AS with_dwell,
  COUNT(*) FILTER (WHERE viewable = true) AS viewable_count
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 2. Check clicks
SELECT 
  'Clicks' AS check_type,
  COUNT(*) AS total,
  MAX(created_at) AS last_click
FROM campaigns.ad_clicks
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 3. Check spend
SELECT 
  'Spend Status' AS check_type,
  spent_credits,
  spend_accrual,
  spent_credits + spend_accrual AS total_spend
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 4. Refresh analytics to see new data
SELECT public.refresh_analytics();

-- 5. Check analytics view
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
ORDER BY day DESC
LIMIT 3;




