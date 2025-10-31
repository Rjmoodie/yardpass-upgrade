-- Check if analytics views have data

-- 1. Check materialized view
SELECT 
  'Materialized View' AS source,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT campaign_id) AS campaigns,
  SUM(impressions) AS total_impressions,
  SUM(clicks) AS total_clicks
FROM public.analytics_campaign_daily_mv;

-- 2. Check base view
SELECT 
  'Base View' AS source,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT campaign_id) AS campaigns,
  SUM(impressions) AS total_impressions,
  SUM(clicks) AS total_clicks
FROM public.analytics_campaign_daily;

-- 3. Check your specific campaign
SELECT 
  day,
  impressions,
  clicks,
  spend_credits,
  ctr
FROM public.analytics_campaign_daily
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC
LIMIT 7;

-- 4. If empty, refresh the materialized view
SELECT public.refresh_analytics();

-- 5. Check again after refresh
SELECT 
  'After Refresh' AS status,
  COUNT(*) AS rows_in_matview
FROM public.analytics_campaign_daily_mv;




