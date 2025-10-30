-- Check what rate_usd_cents was used in Oct 30
SELECT 
  rate_model,
  rate_usd_cents,
  metric_type,
  quantity,
  credits_charged,
  occurred_at
FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY occurred_at DESC
LIMIT 1;

-- Also check the campaign bidding settings again
SELECT 
  id,
  bidding
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

