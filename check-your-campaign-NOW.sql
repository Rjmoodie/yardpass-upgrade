-- ========================================
-- CHECK YOUR CAMPAIGN: 3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec
-- "test- your ad here part 2"
-- ========================================

-- 1. Check raw impressions
SELECT COUNT(*) as total_impressions
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 2. Check raw clicks  
SELECT COUNT(*) as total_clicks
FROM campaigns.ad_clicks
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 3. Check analytics view (correct name!)
SELECT 
  day as date,
  impressions,
  clicks,
  conversions,
  spend_credits
FROM analytics_campaign_daily
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
  AND day >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY day DESC;

-- 4. Check if ANY data exists in last 30 days
SELECT 
  COALESCE(SUM(impressions), 0) as total_impressions,
  COALESCE(SUM(clicks), 0) as total_clicks,
  COALESCE(SUM(conversions), 0) as total_conversions,
  COALESCE(SUM(spend_credits), 0) as total_spend
FROM analytics_campaign_daily
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
  AND day >= CURRENT_DATE - INTERVAL '30 days';

