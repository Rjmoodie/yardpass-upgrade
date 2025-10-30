-- ===================================================================
-- Check Billing Status for Campaign
-- ===================================================================
-- Why is spend $0 despite 3 impressions and 6 clicks?
-- ===================================================================

-- 1. Check if charges are in the ledger
SELECT 
  'Ledger Entries' AS check_type,
  COUNT(*) AS total_entries,
  SUM(credits_charged) AS total_charged,
  SUM(CASE WHEN metric_type = 'impression' THEN 1 ELSE 0 END) AS impression_charges,
  SUM(CASE WHEN metric_type = 'click' THEN 1 ELSE 0 END) AS click_charges
FROM campaigns.ad_spend_ledger 
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 2. Check campaign spent_credits column
SELECT 
  'Campaign Budget' AS check_type,
  spent_credits,
  spend_accrual,
  total_budget_credits,
  daily_budget_credits,
  (spent_credits + spend_accrual) AS total_spend_with_accrual
FROM campaigns.campaigns 
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 3. Check impression/click counts vs charges
SELECT 
  'Activity Summary' AS check_type,
  (SELECT COUNT(*) FROM campaigns.ad_impressions WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec') AS total_impressions,
  (SELECT COUNT(*) FROM campaigns.ad_clicks WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec') AS total_clicks,
  (SELECT COUNT(*) FROM campaigns.ad_spend_ledger WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec') AS ledger_entries;

-- 4. Check recent impressions (see if they have pricing info)
SELECT 
  id,
  campaign_id,
  created_at,
  viewable,
  pct_visible,
  dwell_ms
FROM campaigns.ad_impressions 
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY created_at DESC 
LIMIT 5;

-- 5. Check recent clicks
SELECT 
  id,
  campaign_id,
  created_at,
  impression_id
FROM campaigns.ad_clicks 
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY created_at DESC 
LIMIT 5;

-- 6. Check campaign pricing configuration
SELECT 
  id,
  name,
  bidding::text AS bidding_config,
  pricing_model,
  status
FROM campaigns.campaigns 
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';


