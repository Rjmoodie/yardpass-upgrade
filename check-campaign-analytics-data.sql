-- Check which campaigns have analytics data
-- Run this in Supabase SQL Editor

-- 1. SIMPLE CHECK - Just see your campaigns
SELECT 
  c.id,
  c.name,
  c.status,
  c.org_id,
  c.start_date,
  c.end_date,
  c.created_at
FROM campaigns c
ORDER BY c.created_at DESC
LIMIT 20;

-- 1b. Check with all available columns (if the simple query works)
-- Uncomment this to see what columns exist:
-- SELECT * FROM campaigns LIMIT 1;

-- 2. Check ad_events for impressions and clicks
SELECT 
  ae.campaign_id,
  c.name as campaign_name,
  ae.event_type,
  COUNT(*) as event_count,
  MIN(ae.created_at) as first_event,
  MAX(ae.created_at) as last_event
FROM ad_events ae
JOIN campaigns c ON c.id = ae.campaign_id
WHERE ae.created_at >= NOW() - INTERVAL '30 days'
GROUP BY ae.campaign_id, c.name, ae.event_type
ORDER BY ae.campaign_id, ae.event_type;

-- 3. Check campaign_analytics_daily (the materialized view)
SELECT 
  cad.campaign_id,
  c.name as campaign_name,
  cad.date,
  cad.impressions,
  cad.clicks,
  cad.conversions,
  cad.credits_spent
FROM campaign_analytics_daily cad
JOIN campaigns c ON c.id = cad.campaign_id
WHERE cad.date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY cad.campaign_id, cad.date DESC
LIMIT 50;

-- 4. Check if any campaigns have creatives
SELECT 
  c.id,
  c.name as campaign_name,
  c.status,
  COUNT(cr.id) as creative_count,
  SUM(CASE WHEN cr.is_active THEN 1 ELSE 0 END) as active_creatives
FROM campaigns c
LEFT JOIN ad_creatives cr ON cr.campaign_id = c.id
GROUP BY c.id, c.name, c.status
ORDER BY c.created_at DESC;

-- 5. Check ad delivery eligibility (SIMPLIFIED)
SELECT 
  c.id,
  c.name,
  c.status,
  c.start_date,
  c.end_date,
  CASE 
    WHEN c.status != 'active' THEN 'Campaign not active'
    WHEN c.start_date > CURRENT_DATE THEN 'Start date in future'
    WHEN c.end_date IS NOT NULL AND c.end_date < CURRENT_DATE THEN 'Campaign ended'
    WHEN NOT EXISTS(SELECT 1 FROM ad_creatives WHERE campaign_id = c.id AND active = true) THEN 'No active creatives'
    ELSE 'Should be eligible for delivery'
  END as delivery_issue
FROM campaigns c
ORDER BY c.created_at DESC;

