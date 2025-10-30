-- SIMPLIFIED Campaign Analytics Check
-- Run these queries one at a time in Supabase SQL Editor

-- ========================================
-- QUERY 1: See all your campaigns
-- ========================================
SELECT * FROM campaigns 
ORDER BY created_at DESC 
LIMIT 10;

-- ========================================
-- QUERY 2: Count impressions and clicks per campaign
-- ========================================
SELECT 
  ae.campaign_id,
  COUNT(*) FILTER (WHERE ae.event_type = 'impression') as total_impressions,
  COUNT(*) FILTER (WHERE ae.event_type = 'click') as total_clicks,
  MIN(ae.created_at) as first_event,
  MAX(ae.created_at) as last_event
FROM ad_events ae
GROUP BY ae.campaign_id
ORDER BY total_impressions DESC;

-- ========================================
-- QUERY 3: Check specific campaign by ID
-- Replace 'YOUR_CAMPAIGN_ID_HERE' with actual campaign ID
-- ========================================
SELECT 
  c.*,
  (SELECT COUNT(*) FROM ad_events WHERE campaign_id = c.id AND event_type = 'impression') as total_impressions,
  (SELECT COUNT(*) FROM ad_events WHERE campaign_id = c.id AND event_type = 'click') as total_clicks,
  (SELECT COUNT(*) FROM ad_creatives WHERE campaign_id = c.id) as total_creatives
FROM campaigns c
-- WHERE c.id = 'YOUR_CAMPAIGN_ID_HERE'
ORDER BY c.created_at DESC
LIMIT 10;

-- ========================================
-- QUERY 4: Check which campaigns have analytics data
-- ========================================
SELECT 
  cad.campaign_id,
  cad.date,
  SUM(cad.impressions) as impressions,
  SUM(cad.clicks) as clicks,
  SUM(cad.conversions) as conversions,
  SUM(cad.credits_spent) as credits_spent
FROM campaign_analytics_daily cad
WHERE cad.date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY cad.campaign_id, cad.date
ORDER BY cad.campaign_id, cad.date DESC;

-- ========================================
-- QUERY 5: Get campaign with name
-- ========================================
SELECT 
  c.id,
  c.name,
  c.status,
  COUNT(ae.id) FILTER (WHERE ae.event_type = 'impression') as impressions,
  COUNT(ae.id) FILTER (WHERE ae.event_type = 'click') as clicks
FROM campaigns c
LEFT JOIN ad_events ae ON ae.campaign_id = c.id
GROUP BY c.id, c.name, c.status
HAVING COUNT(ae.id) FILTER (WHERE ae.event_type = 'impression') > 0
   OR COUNT(ae.id) FILTER (WHERE ae.event_type = 'click') > 0
ORDER BY c.created_at DESC;

