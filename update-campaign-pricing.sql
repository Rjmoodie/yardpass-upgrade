-- Update campaign pricing to $5 CPM (500 credits)
-- Where 100 credits = $1, so 500 credits = $5 CPM

UPDATE campaigns.campaigns
SET 
  pricing_model = 'cpm',
  cpm_rate_credits = 500,
  cpc_rate_credits = 50,  -- Also set reasonable CPC if needed (500 clicks per 10k impressions @ 2.5% CTR)
  updated_at = NOW()
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Verify the update
SELECT 
  id,
  name,
  pricing_model,
  cpm_rate_credits,
  cpc_rate_credits,
  spent_credits,
  spend_accrual,
  total_budget_credits,
  status
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

