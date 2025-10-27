-- Check all columns in campaigns.campaigns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'campaigns' 
  AND table_name = 'campaigns'
  AND (
    column_name LIKE '%price%' OR 
    column_name LIKE '%rate%' OR 
    column_name LIKE '%cpm%' OR 
    column_name LIKE '%cpc%' OR
    column_name LIKE '%credit%' OR
    column_name LIKE '%budget%'
  )
ORDER BY ordinal_position;

-- Check the actual campaign data
SELECT 
  id,
  name,
  pricing_model,
  total_budget_credits,
  daily_budget_credits,
  spent_credits,
  spend_accrual
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

