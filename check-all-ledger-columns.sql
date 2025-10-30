-- Check ALL columns in the actual Oct 30 entry
SELECT *
FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY occurred_at DESC
LIMIT 1;

