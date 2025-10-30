-- Clear test impressions for your campaign
-- This will let you test billing from scratch

-- Delete in correct order to respect foreign keys:
-- 1. Clicks (reference impressions)
DELETE FROM campaigns.ad_clicks 
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
  AND session_id = '45799dfcf6f779be0afb9fc3dc12808f01abd4ecdbdba0c4';

-- 2. Impressions
DELETE FROM campaigns.ad_impressions 
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
  AND session_id = '45799dfcf6f779be0afb9fc3dc12808f01abd4ecdbdba0c4';

-- 3. Spend ledger
DELETE FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Reset campaign spend
UPDATE campaigns.campaigns
SET 
  spent_credits = 0,
  spend_accrual = 0
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Verify clean slate
SELECT 
  spent_credits,
  spend_accrual,
  total_budget_credits
FROM campaigns.campaigns 
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

