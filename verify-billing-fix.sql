-- ===================================================================
-- Verify Billing Fix is Working
-- ===================================================================

-- 1. Check current spend status
SELECT 
  'Current Spend' AS check_type,
  spent_credits,
  spend_accrual,
  (spent_credits + spend_accrual) AS total_with_accrual
FROM campaigns.campaigns 
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 2. Check ledger entries (if any reached 1 credit threshold)
SELECT 
  'Ledger Entries' AS check_type,
  COUNT(*) AS total_entries,
  SUM(credits_charged) AS total_charged,
  MIN(occurred_at) AS first_charge,
  MAX(occurred_at) AS last_charge
FROM campaigns.ad_spend_ledger 
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 3. Check recent impressions with details
SELECT 
  'Recent Impressions' AS check_type,
  COUNT(*) AS total_count,
  MAX(created_at) AS most_recent
FROM campaigns.ad_impressions 
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 4. Calculate expected charges
SELECT 
  'Expected Charges' AS check_type,
  COUNT(*) AS impression_count,
  (COUNT(*) * 0.5) AS expected_total_credits,
  CASE 
    WHEN COUNT(*) * 0.5 >= 1 
    THEN FLOOR(COUNT(*) * 0.5)
    ELSE 0
  END AS expected_spent_credits,
  CASE 
    WHEN COUNT(*) * 0.5 >= 1 
    THEN MOD((COUNT(*) * 0.5)::NUMERIC, 1)
    ELSE COUNT(*) * 0.5
  END AS expected_accrual
FROM campaigns.ad_impressions 
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 5. Show what rate get_eligible_ads returns now
SELECT 
  'Feed Ad Rate' AS check_type,
  campaign_id,
  estimated_rate,
  pricing_model
FROM campaigns.get_eligible_ads(
  p_placement := 'feed',
  p_limit := 1
)
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- ===================================================================
-- Interpretation Guide:
-- ===================================================================
-- Current Spend:
--   - If still 0.004: Need to trigger NEW impressions with fixed rate
--   - If ~0.5 or more: Fix is working! New impressions being charged correctly
--
-- Expected Charges:
--   - At $5 CPM (500 credits per 1000): Each impression = 0.5 credits
--   - After 2 impressions: 1 credit in spent_credits, 0 in accrual
--   - After 3 impressions: 1 credit in spent_credits, 0.5 in accrual
--
-- Feed Ad Rate:
--   - Should show 500 (credits), not 2.06 or 5.00 (USD)
-- ===================================================================



