-- Update campaign pricing to $5 CPM (500 credits = $5.00 = 500 cents)
-- Where 100 credits = $1

UPDATE campaigns.campaigns
SET 
  bidding = jsonb_set(
    bidding,
    '{bid_cents}',
    '500'::jsonb
  ),
  updated_at = NOW()
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Verify the update
SELECT 
  id,
  name,
  pricing_model,
  bidding,
  spent_credits,
  spend_accrual,
  total_budget_credits
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Show the pricing breakdown
SELECT 
  '✅ Campaign Pricing Updated' as status,
  '$5.00 CPM' as cpm_usd,
  '500 credits per 1000 impressions' as cpm_credits,
  '0.5 credits per impression' as cost_per_impression,
  '20,000 impressions per 10,000 credits' as impressions_per_10k_credits;

