-- ===================================================================
-- Diagnose Billing Issue - Run each query separately
-- ===================================================================

-- Query 1: Check ledger entries
SELECT 
  COUNT(*) AS ledger_entries,
  SUM(credits_charged) AS total_charged,
  SUM(CASE WHEN metric_type = 'impression' THEN credits_charged ELSE 0 END) AS impression_charges,
  SUM(CASE WHEN metric_type = 'click' THEN credits_charged ELSE 0 END) AS click_charges
FROM campaigns.ad_spend_ledger 
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Query 2: Check campaign spend columns
SELECT 
  spent_credits,
  spend_accrual,
  total_budget_credits,
  (spent_credits + spend_accrual) AS total_with_accrual
FROM campaigns.campaigns 
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Query 3: Check if impressions were logged
SELECT 
  id,
  created_at,
  viewable,
  pct_visible,
  dwell_ms,
  request_id
FROM campaigns.ad_impressions 
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY created_at DESC 
LIMIT 5;


