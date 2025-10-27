-- Test Ad Billing System
-- This verifies that impressions and clicks are being charged properly

-- 1. Check campaign budget
SELECT 
  name AS campaign_name,
  pricing_model,
  total_budget_credits,
  spent_credits,
  (total_budget_credits - COALESCE(spent_credits, 0)) AS remaining_credits
FROM campaigns.campaigns
WHERE name = 'test- your ad here part 2';

-- 2. Check recent impressions with pricing details
SELECT 
  ai.id AS impression_id,
  c.name AS campaign_name,
  c.pricing_model,
  ai.placement,
  ai.dwell_ms,
  ai.viewable,
  ai.pct_visible,
  ai.created_at
FROM campaigns.ad_impressions ai
JOIN campaigns.campaigns c ON c.id = ai.campaign_id
WHERE c.name = 'test- your ad here part 2'
ORDER BY ai.created_at DESC
LIMIT 5;

-- 3. Check recent clicks with pricing details
SELECT 
  ac.id AS click_id,
  c.name AS campaign_name,
  c.pricing_model,
  ac.impression_id,
  ac.request_id,
  ac.clicked_at
FROM campaigns.ad_clicks ac
JOIN campaigns.campaigns c ON c.id = ac.campaign_id
WHERE c.name = 'test- your ad here part 2'
ORDER BY ac.clicked_at DESC
LIMIT 5;

-- 4. Summary with CTR and billing
SELECT 
  c.name AS campaign_name,
  c.pricing_model,
  COUNT(DISTINCT ai.id) AS impressions,
  COUNT(DISTINCT ac.id) AS clicks,
  ROUND(COUNT(DISTINCT ac.id)::NUMERIC / NULLIF(COUNT(DISTINCT ai.id), 0) * 100, 2) AS ctr_percent,
  c.spent_credits AS total_credits_spent,
  CASE 
    WHEN c.pricing_model = 'cpm' THEN COUNT(DISTINCT ai.id)
    WHEN c.pricing_model = 'cpc' THEN COUNT(DISTINCT ac.id)
    ELSE 0
  END AS billable_events,
  c.total_budget_credits - COALESCE(c.spent_credits, 0) AS remaining_credits
FROM campaigns.campaigns c
LEFT JOIN campaigns.ad_impressions ai ON ai.campaign_id = c.id
LEFT JOIN campaigns.ad_clicks ac ON ac.campaign_id = c.id
WHERE c.name = 'test- your ad here part 2'
GROUP BY c.id, c.name, c.pricing_model;


