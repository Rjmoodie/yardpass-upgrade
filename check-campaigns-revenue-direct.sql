-- Check if there's a revenue field in campaigns table
SELECT 
  id,
  name,
  spent_credits,
  total_budget_credits
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Check campaigns_overview
SELECT 
  id,
  name,
  spent_credits,
  total_impressions,
  total_clicks,
  total_conversions
FROM public.campaigns_overview
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Check if there's revenue in the analytics view
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'analytics_campaign_daily_mv'
  AND column_name LIKE '%revenue%';

