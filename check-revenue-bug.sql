-- Check where the $1000 revenue is coming from

-- 1. Check conversions and conversion values
SELECT 
  campaign_id,
  value_cents,
  occurred_at,
  attribution_model
FROM campaigns.ad_conversions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY occurred_at DESC;
-- Expected: Empty (0 conversions)

-- 2. Check analytics for revenue_cents
SELECT 
  day,
  conversions,
  conversion_value_cents,
  spend_credits
FROM analytics_campaign_daily_mv
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC;
-- Expected: conversion_value_cents should be 0

-- 3. Check campaigns_overview (what the UI queries)
SELECT 
  id,
  name,
  total_impressions,
  total_clicks,
  total_conversions,
  spent_credits
FROM public.campaigns_overview
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 4. Check if there's a revenue field in campaigns table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'campaigns'
  AND table_name = 'campaigns'
  AND column_name LIKE '%revenue%';

