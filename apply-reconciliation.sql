-- ========================================
-- APPLY RECONCILIATION FOR OCT 28
-- ========================================

-- Step 1: Apply the reconciliation (for real this time)
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
  FALSE  -- DRY RUN = FALSE (apply changes!)
);

-- Step 2: Verify no more missing charges
SELECT 
  campaign_id,
  day,
  metric_type,
  missing_count,
  should_charge_credits
FROM campaigns.find_missing_charges(
  '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'::UUID,
  7
);
-- Expected: Empty (no missing charges)

-- Step 3: Check updated campaign budget
SELECT 
  id,
  name,
  spent_credits,
  total_budget_credits
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';
-- Expected: spent_credits = 12.00 (was 11.00, now +1.00)

-- Step 4: Check the new ledger entry
SELECT 
  DATE(occurred_at) AS day,
  metric_type,
  quantity,
  credits_charged,
  notes
FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY occurred_at DESC
LIMIT 3;
-- Expected: New entry for Oct 28 with 1.00 credits

-- Step 5: Check reconciliation log
SELECT * FROM public.reconciliation_summary
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY reconciliation_date DESC
LIMIT 1;
-- Expected: Shows 1 missing impression, 1.00 credits charged

-- Step 6: Refresh materialized view
REFRESH MATERIALIZED VIEW analytics_campaign_daily_mv;

-- Step 7: Verify analytics updated
SELECT 
  day,
  impressions,
  clicks,
  spend_credits
FROM analytics_campaign_daily_mv
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC
LIMIT 5;
-- Expected: Oct 28 now shows 1.00 credit spend

