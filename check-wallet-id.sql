-- Check what wallet IDs were used in Oct 30 entry
SELECT 
  org_wallet_id,
  user_wallet_id,
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

-- Also check the campaign's org_id
SELECT 
  id,
  org_id,
  name
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

