-- Verify billing with NEW rate (500 credits = $5 CPM)
-- Expected: 0.5 credits per impression (500 / 1000)

SELECT 
  spent_credits,
  spend_accrual,
  (spent_credits + spend_accrual) AS total_charged,
  total_budget_credits,
  (total_budget_credits - spent_credits - spend_accrual) AS remaining
FROM campaigns.campaigns 
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

SELECT 
  COUNT(*) AS total_impressions,
  SUM(CASE WHEN created_at > NOW() - INTERVAL '5 minutes' THEN 1 ELSE 0 END) AS recent_impressions
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

SELECT 
  metric_type,
  credits_charged,
  rate_usd_cents,
  occurred_at
FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY occurred_at DESC
LIMIT 10;


