-- Check campaign bidding settings
SELECT 
  id,
  name,
  status,
  bidding,
  bidding->>'model' AS bidding_model,
  bidding->>'cpm_credits' AS cpm_credits,
  bidding->>'bid_cents' AS bid_cents,
  total_budget_credits,
  spent_credits
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Check what the actual impressions cost on Oct 30
SELECT 
  DATE(occurred_at) AS day,
  metric_type,
  quantity,
  credits_charged,
  credits_charged / quantity AS cost_per_impression
FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
  AND metric_type = 'impression'
ORDER BY occurred_at DESC;

