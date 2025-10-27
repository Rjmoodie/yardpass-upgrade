-- Check Ad Accounting Tables

\echo '=== 1. AD SPEND LEDGER (Individual Charges) ==='
SELECT 
  campaign_id,
  creative_id,
  metric_type,
  quantity,
  rate_model,
  credits_charged,
  occurred_at
FROM campaigns.ad_spend_ledger
ORDER BY occurred_at DESC
LIMIT 20;

\echo ''
\echo '=== 2. CAMPAIGN BUDGET STATUS ==='
SELECT 
  id as campaign_id,
  name,
  total_budget_credits,
  daily_budget_credits,
  spent_credits,
  spend_accrual,
  status
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

\echo ''
\echo '=== 3. RECENT AD IMPRESSIONS ==='
SELECT 
  id as impression_id,
  campaign_id,
  creative_id,
  session_id,
  placement,
  viewable,
  pct_visible,
  dwell_ms,
  created_at
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY created_at DESC
LIMIT 10;

\echo ''
\echo '=== 4. RECENT AD CLICKS ==='
SELECT 
  id as click_id,
  impression_id,
  campaign_id,
  creative_id,
  session_id,
  created_at
FROM campaigns.ad_clicks
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY created_at DESC
LIMIT 10;

\echo ''
\echo '=== 5. SUMMARY ==='
SELECT 
  (SELECT COUNT(*) FROM campaigns.ad_impressions WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec') as total_impressions,
  (SELECT COUNT(*) FROM campaigns.ad_clicks WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec') as total_clicks,
  (SELECT COUNT(*) FROM campaigns.ad_spend_ledger WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec') as total_ledger_entries,
  (SELECT COALESCE(SUM(credits_charged), 0) FROM campaigns.ad_spend_ledger WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec') as total_credits_charged,
  (SELECT spent_credits FROM campaigns.campaigns WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec') as campaign_spent_credits,
  (SELECT spend_accrual FROM campaigns.campaigns WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec') as campaign_spend_accrual;

