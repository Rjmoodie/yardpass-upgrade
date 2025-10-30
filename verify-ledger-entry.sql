-- After 2nd impression, should see ledger entry for 1 credit

-- Campaign balance
SELECT 
  spent_credits,
  spend_accrual,
  (spent_credits + spend_accrual) AS total_charged
FROM campaigns.campaigns 
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Ledger (should now have 1 row!)
SELECT 
  metric_type,
  credits_charged,
  rate_usd_cents,
  org_wallet_id IS NOT NULL AS has_wallet,
  occurred_at
FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY occurred_at DESC;

-- Impressions count
SELECT COUNT(*) AS total_impressions
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';


