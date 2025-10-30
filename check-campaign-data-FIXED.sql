-- ========================================
-- FIXED: Check Campaign Analytics Data
-- Tables are in campaigns schema!
-- ========================================

-- 1. Check impressions for your campaign
SELECT 
  'impressions' as event_type,
  COUNT(*) as count,
  MIN(created_at) as first_event,
  MAX(created_at) as last_event
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'

UNION ALL

-- 2. Check clicks for your campaign
SELECT 
  'clicks' as event_type,
  COUNT(*) as count,
  MIN(created_at) as first_event,
  MAX(created_at) as last_event
FROM campaigns.ad_clicks
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- ========================================
-- 3. Check campaign_analytics_daily
-- ========================================
SELECT 
  date,
  impressions,
  clicks,
  conversions,
  credits_spent
FROM campaign_analytics_daily
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY date DESC;

-- ========================================
-- 4. Check if materialized view needs refresh
-- ========================================
SELECT 
  schemaname,
  matviewname,
  hasindexes,
  ispopulated,
  definition
FROM pg_matviews
WHERE matviewname = 'campaign_analytics_daily';

-- ========================================
-- 5. Refresh the materialized view (if needed)
-- ========================================
-- Uncomment and run this if the view is empty:
-- REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_analytics_daily;

-- ========================================
-- 6. Check all campaigns with impressions/clicks
-- ========================================
SELECT 
  c.id,
  c.name,
  c.status,
  COALESCE(imp.impression_count, 0) as impressions,
  COALESCE(clk.click_count, 0) as clicks
FROM campaigns c
LEFT JOIN (
  SELECT campaign_id, COUNT(*) as impression_count
  FROM campaigns.ad_impressions
  GROUP BY campaign_id
) imp ON imp.campaign_id = c.id
LEFT JOIN (
  SELECT campaign_id, COUNT(*) as click_count
  FROM campaigns.ad_clicks
  GROUP BY campaign_id
) clk ON clk.campaign_id = c.id
WHERE c.status = 'active'
ORDER BY impressions DESC, clicks DESC;

