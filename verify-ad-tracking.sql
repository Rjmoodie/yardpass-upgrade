-- Verify the ad tracking system is working

-- 1. Check impressions
SELECT 
  ai.id AS impression_id,
  c.name AS campaign_name,
  ai.placement,
  ai.dwell_ms,
  ai.viewable,
  ai.pct_visible,
  ai.created_at,
  ai.hour_bucket
FROM campaigns.ad_impressions ai
JOIN campaigns.campaigns c ON c.id = ai.campaign_id
WHERE c.name = 'test- your ad here part 2'
ORDER BY ai.created_at DESC
LIMIT 5;

-- 2. Check clicks
SELECT 
  ac.id AS click_id,
  c.name AS campaign_name,
  ac.impression_id,
  ac.request_id,
  ac.clicked_at,
  ac.minute_bucket
FROM campaigns.ad_clicks ac
JOIN campaigns.campaigns c ON c.id = ac.campaign_id
WHERE c.name = 'test- your ad here part 2'
ORDER BY ac.clicked_at DESC
LIMIT 5;

-- 3. Summary stats
SELECT 
  c.name AS campaign_name,
  COUNT(DISTINCT ai.id) AS impressions,
  COUNT(DISTINCT ac.id) AS clicks,
  COUNT(DISTINCT ac.impression_id) AS clicks_with_impression_id,
  ROUND(COUNT(DISTINCT ac.id)::NUMERIC / NULLIF(COUNT(DISTINCT ai.id), 0) * 100, 2) AS ctr_percent,
  c.spent_credits AS total_credits_spent,
  c.total_budget_credits - COALESCE(c.spent_credits, 0) AS remaining_credits
FROM campaigns.campaigns c
LEFT JOIN campaigns.ad_impressions ai ON ai.campaign_id = c.id
LEFT JOIN campaigns.ad_clicks ac ON ac.campaign_id = c.id
WHERE c.name = 'test- your ad here part 2'
GROUP BY c.id, c.name;

