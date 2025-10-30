-- Check ONLY the campaign bidding settings
SELECT 
  id,
  name,
  status,
  bidding,
  total_budget_credits,
  spent_credits
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

