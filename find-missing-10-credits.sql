-- Where are the missing 10 credits?
-- Campaign shows 12 spent, but ledger only shows 2

-- Check ALL ledger entries for this campaign (not just this wallet)
SELECT 
  org_wallet_id,
  campaign_id,
  metric_type,
  quantity,
  credits_charged,
  occurred_at,
  reason
FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY occurred_at;

-- Check campaign spent_credits history
SELECT 
  id,
  name,
  spent_credits,
  spend_accrual,
  total_budget_credits
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Sum of all ledger entries for this campaign
SELECT 
  SUM(credits_charged) AS total_ledger_credits,
  COUNT(*) AS total_entries
FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

