-- =====================================================
-- DIAGNOSE MATERIALIZED VIEW JOIN ISSUE
-- =====================================================

-- 1. Check raw impressions data
SELECT 
  'RAW IMPRESSIONS' AS data_source,
  campaign_id,
  COUNT(*) AS total,
  DATE(created_at AT TIME ZONE 'UTC') AS day_utc,
  AVG(dwell_ms) AS avg_dwell,
  MIN(created_at) AS first_impression,
  MAX(created_at) AS last_impression
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
GROUP BY campaign_id, DATE(created_at AT TIME ZONE 'UTC')
ORDER BY day_utc DESC;

-- 2. Check what calendar days exist
SELECT 
  'CALENDAR DAYS' AS data_source,
  day,
  CURRENT_DATE AS today,
  day - CURRENT_DATE AS days_from_today
FROM util.calendar_day
WHERE day >= CURRENT_DATE - 7
  AND day <= CURRENT_DATE + 7
ORDER BY day DESC
LIMIT 14;

-- 3. Check campaign date range
SELECT 
  'CAMPAIGN DATES' AS data_source,
  id,
  name,
  start_date,
  end_date,
  CURRENT_DATE AS today,
  CASE 
    WHEN start_date > CURRENT_DATE THEN 'Future campaign'
    WHEN end_date < CURRENT_DATE THEN 'Ended'
    ELSE 'Active'
  END AS status
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 4. Check what the impression aggregation subquery produces
SELECT 
  'IMPRESSION SUBQUERY' AS data_source,
  campaign_id,
  DATE(created_at AT TIME ZONE 'UTC') AS day,
  COUNT(*) AS impressions,
  COUNT(*) FILTER (WHERE viewable = true) AS viewable_impressions,
  AVG(dwell_ms) AS avg_dwell_ms
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
GROUP BY campaign_id, DATE(created_at AT TIME ZONE 'UTC')
ORDER BY day DESC;

-- 5. Simulate the full materialized view join for this campaign
SELECT 
  'SIMULATED MATVIEW' AS data_source,
  c.id AS campaign_id,
  d.day,
  COALESCE(imp.impressions, 0) AS impressions,
  COALESCE(imp.avg_dwell_ms, 0) AS avg_dwell_ms,
  d.day AS calendar_day,
  c.start_date,
  c.end_date,
  CASE 
    WHEN d.day >= c.start_date AND d.day <= COALESCE(c.end_date, CURRENT_DATE + INTERVAL '1 year') 
    THEN 'In range' 
    ELSE 'Out of range' 
  END AS day_status
FROM campaigns.campaigns c
CROSS JOIN util.calendar_day d
LEFT JOIN (
  SELECT 
    campaign_id,
    DATE(created_at AT TIME ZONE 'UTC') AS day,
    COUNT(*) AS impressions,
    AVG(dwell_ms) AS avg_dwell_ms
  FROM campaigns.ad_impressions
  GROUP BY campaign_id, DATE(created_at AT TIME ZONE 'UTC')
) imp ON imp.campaign_id = c.id AND imp.day = d.day
WHERE c.id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
  AND d.day >= CURRENT_DATE - 7
  AND d.day <= CURRENT_DATE + 1
ORDER BY d.day DESC;


