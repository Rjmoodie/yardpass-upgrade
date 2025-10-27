-- Verify ad billing is working

-- 1. Check if ad_spend_ledger table exists and has entries
SELECT 
  'ad_spend_ledger' AS table_name,
  COUNT(*) AS total_charges,
  SUM(credits_charged) AS total_credits_charged,
  STRING_AGG(DISTINCT metric_type, ', ') AS charge_types
FROM campaigns.ad_spend_ledger;

-- 2. Check recent charges
SELECT 
  metric_type,
  quantity,
  rate_model,
  credits_charged,
  occurred_at
FROM campaigns.ad_spend_ledger
ORDER BY occurred_at DESC
LIMIT 10;

-- 3. Check campaign budget status
SELECT 
  c.name AS campaign_name,
  c.pricing_model,
  COUNT(DISTINCT ai.id) AS impressions,
  COUNT(DISTINCT ac.id) AS clicks,
  ROUND(COUNT(DISTINCT ac.id)::NUMERIC / NULLIF(COUNT(DISTINCT ai.id), 0) * 100, 2) AS ctr_percent,
  c.spent_credits AS total_credits_spent,
  c.total_budget_credits - COALESCE(c.spent_credits, 0) AS remaining_credits,
  COALESCE(SUM(asl.credits_charged), 0) AS ledger_total
FROM campaigns.campaigns c
LEFT JOIN campaigns.ad_impressions ai ON ai.campaign_id = c.id
LEFT JOIN campaigns.ad_clicks ac ON ac.campaign_id = c.id
LEFT JOIN campaigns.ad_spend_ledger asl ON asl.campaign_id = c.id
WHERE c.name = 'test- your ad here part 2'
GROUP BY c.id, c.name, c.pricing_model;

-- 4. Verify impressions vs charges
SELECT 
  COUNT(DISTINCT ai.id) AS total_impressions,
  COUNT(DISTINCT CASE WHEN asl.metric_type = 'impression' THEN asl.id END) AS impression_charges,
  COUNT(DISTINCT ac.id) AS total_clicks,
  COUNT(DISTINCT CASE WHEN asl.metric_type = 'click' THEN asl.id END) AS click_charges
FROM campaigns.ad_impressions ai
LEFT JOIN campaigns.ad_spend_ledger asl ON asl.campaign_id = ai.campaign_id
LEFT JOIN campaigns.ad_clicks ac ON ac.campaign_id = ai.campaign_id
WHERE ai.campaign_id = (
  SELECT id FROM campaigns.campaigns WHERE name = 'test- your ad here part 2' LIMIT 1
);


