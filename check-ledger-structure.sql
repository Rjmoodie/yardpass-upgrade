-- Check the actual structure of ad_spend_ledger
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'campaigns' 
  AND table_name = 'ad_spend_ledger'
ORDER BY ordinal_position;

-- Check existing ledger entries to see what values are used
SELECT 
  rate_model,
  metric_type,
  quantity,
  credits_charged,
  occurred_at
FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY occurred_at DESC
LIMIT 3;

