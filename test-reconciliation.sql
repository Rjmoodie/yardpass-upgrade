-- ========================================
-- TEST RECONCILIATION SYSTEM
-- ========================================

-- Step 1: Find missing charges (read-only, safe to run)
SELECT 
  campaign_id,
  day,
  metric_type,
  delivered_count,
  charged_count,
  missing_count,
  should_charge_credits
FROM campaigns.find_missing_charges(
  '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'::UUID,
  7
);

-- Expected result: Should show Oct 28 with 1 missing impression

-- ========================================
-- Step 2: Dry run (preview what will be fixed, no changes)
-- ========================================
SELECT 
  campaign_id,
  total_missing_impressions,
  total_missing_clicks,
  total_credits_charged,
  ledger_entries_created,
  campaigns_updated
FROM campaigns.reconcile_missing_charges(
  '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'::UUID,
  7,
  TRUE  -- DRY RUN = TRUE (no changes made)
);

-- Expected result: Shows 1 missing impression, ~0.50 credits to charge

-- ========================================
-- Step 3: Apply the fix (for real)
-- ========================================
-- Uncomment to apply:
/*
SELECT 
  campaign_id,
  total_missing_impressions,
  total_missing_clicks,
  total_credits_charged,
  ledger_entries_created,
  campaigns_updated
FROM campaigns.reconcile_missing_charges(
  '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'::UUID,
  7,
  FALSE  -- DRY RUN = FALSE (apply changes)
);
*/

-- ========================================
-- Step 4: Verify the fix worked
-- ========================================
-- Uncomment after applying fix:
/*
-- Should show no missing charges
SELECT * FROM campaigns.find_missing_charges(
  '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'::UUID,
  7
);

-- Check reconciliation log
SELECT * FROM public.reconciliation_summary
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY reconciliation_date DESC
LIMIT 1;

-- Check updated campaign budget
SELECT 
  id,
  name,
  spent_credits,
  total_budget_credits
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Check the analytics view updated
SELECT 
  day,
  impressions,
  clicks,
  spend_credits
FROM analytics_campaign_daily_mv
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC
LIMIT 5;
*/

