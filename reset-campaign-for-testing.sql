-- =====================================================
-- RESET CAMPAIGN FOR FRESH TESTING
-- =====================================================
-- This will clear ALL impressions, clicks, and spend
-- for campaign 3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec
-- =====================================================

-- 1. Delete clicks first (foreign key to impressions)
DELETE FROM campaigns.ad_clicks 
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 2. Delete impressions
DELETE FROM campaigns.ad_impressions 
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 3. Delete spend ledger entries
DELETE FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 4. Reset campaign spend counters
UPDATE campaigns.campaigns
SET 
  spent_credits = 0,
  spend_accrual = 0
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 5. Verify clean slate
SELECT 
  'Campaign reset complete!' AS status,
  id,
  name,
  spent_credits,
  spend_accrual,
  total_budget_credits,
  (SELECT COUNT(*) FROM campaigns.ad_impressions WHERE campaign_id = campaigns.campaigns.id) AS impressions,
  (SELECT COUNT(*) FROM campaigns.ad_clicks WHERE campaign_id = campaigns.campaigns.id) AS clicks,
  (SELECT COUNT(*) FROM campaigns.ad_spend_ledger WHERE campaign_id = campaigns.campaigns.id) AS ledger_entries
FROM campaigns.campaigns 
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- 6. Refresh analytics
SELECT public.refresh_analytics();

-- Next Steps:
-- 1. Open your app feed
-- 2. Scroll to the promoted ad
-- 3. Watch for 2+ seconds (dwell time)
-- 4. Click the ad
-- 5. Check dashboard for updated metrics

