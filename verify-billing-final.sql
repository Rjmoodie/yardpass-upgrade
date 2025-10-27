-- Final comprehensive billing verification

-- 1. Check ad_spend_ledger entries
SELECT 
  'ad_spend_ledger' AS table_name,
  metric_type,
  COUNT(*) AS entries,
  SUM(credits_charged) AS total_charged,
  AVG(credits_charged) AS avg_charged,
  MIN(credits_charged) AS min_charged,
  MAX(credits_charged) AS max_charged
FROM campaigns.ad_spend_ledger
WHERE campaign_id = (SELECT id FROM campaigns.campaigns WHERE name = 'test- your ad here part 2' LIMIT 1)
GROUP BY metric_type;

-- 2. Check campaign budget and accrual
SELECT 
  name AS campaign_name,
  pricing_model,
  total_budget_credits,
  spent_credits,
  spend_accrual,
  (total_budget_credits - spent_credits) AS remaining_budget,
  ROUND((spent_credits / NULLIF(total_budget_credits, 0) * 100), 2) AS pct_spent
FROM campaigns.campaigns
WHERE name = 'test- your ad here part 2';

-- 3. Check impression/click counts vs charges
SELECT 
  'Impressions' AS metric,
  COUNT(DISTINCT ai.id) AS events,
  COUNT(DISTINCT CASE WHEN asl.metric_type = 'impression' THEN asl.id END) AS ledger_entries,
  SUM(CASE WHEN asl.metric_type = 'impression' THEN asl.credits_charged ELSE 0 END) AS credits_charged
FROM campaigns.ad_impressions ai
LEFT JOIN campaigns.ad_spend_ledger asl ON asl.campaign_id = ai.campaign_id
WHERE ai.campaign_id = (SELECT id FROM campaigns.campaigns WHERE name = 'test- your ad here part 2' LIMIT 1)

UNION ALL

SELECT 
  'Clicks' AS metric,
  COUNT(DISTINCT ac.id) AS events,
  COUNT(DISTINCT CASE WHEN asl.metric_type = 'click' THEN asl.id END) AS ledger_entries,
  SUM(CASE WHEN asl.metric_type = 'click' THEN asl.credits_charged ELSE 0 END) AS credits_charged
FROM campaigns.ad_clicks ac
LEFT JOIN campaigns.ad_spend_ledger asl ON asl.campaign_id = ac.campaign_id
WHERE ac.campaign_id = (SELECT id FROM campaigns.campaigns WHERE name = 'test- your ad here part 2' LIMIT 1);

-- 4. Recent ledger entries (last 10)
SELECT 
  metric_type,
  quantity,
  rate_model,
  credits_charged,
  TO_CHAR(occurred_at, 'YYYY-MM-DD HH24:MI:SS') AS occurred_at
FROM campaigns.ad_spend_ledger
WHERE campaign_id = (SELECT id FROM campaigns.campaigns WHERE name = 'test- your ad here part 2' LIMIT 1)
ORDER BY occurred_at DESC
LIMIT 10;


