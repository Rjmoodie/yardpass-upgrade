-- ========================================
-- DIAGNOSE SPEND DISCREPANCY
-- ========================================
-- This will help us understand why "Spend" shows 0.50 credits
-- but the campaign spent_credits shows 1 credit (or 11 after test)

-- ========================================
-- Query 1: What does analytics_campaign_daily show?
-- ========================================
SELECT 
  day,
  impressions,
  clicks,
  spend_credits,
  ecpm,
  cpc,
  ctr
FROM public.analytics_campaign_daily
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC;

-- ========================================
-- Query 2: What's the actual campaign budget status?
-- ========================================
SELECT 
  id,
  name,
  total_budget_credits,
  spent_credits,
  daily_budget_credits,
  status,
  bidding
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- ========================================
-- Query 3: What's in the ad_spend_ledger?
-- ========================================
SELECT 
  metric_type,
  quantity,
  credits_charged,
  occurred_at
FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY occurred_at DESC;

-- ========================================
-- Query 4: Check ad_impressions table structure
-- ========================================
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'campaigns' 
  AND table_name = 'ad_impressions'
ORDER BY ordinal_position;

-- ========================================
-- Query 5: Check what tracking tables exist in campaigns schema
-- ========================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'campaigns' 
  AND table_name LIKE '%ad%'
ORDER BY table_name;

-- ========================================
-- Query 6: Count impressions from ad_impressions
-- ========================================
SELECT 
  COUNT(*) as total_impressions
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- ========================================
-- Query 7: Count clicks from ad_clicks
-- ========================================
SELECT 
  COUNT(*) as total_clicks
FROM campaigns.ad_clicks
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- ========================================
-- Query 8: Check the analytics_campaign_daily view definition
-- ========================================
-- This will show us HOW spend_credits is being calculated
SELECT 
  pg_get_viewdef('public.analytics_campaign_daily', true);

