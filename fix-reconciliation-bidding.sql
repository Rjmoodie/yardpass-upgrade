-- ========================================
-- FIX: Reconciliation to use bid_cents instead of cpm_credits
-- ========================================

-- Drop and recreate the function with correct bidding field
CREATE OR REPLACE FUNCTION campaigns.find_missing_charges(
  p_campaign_id UUID DEFAULT NULL,
  p_lookback_days INT DEFAULT 7
)
RETURNS TABLE (
  campaign_id UUID,
  day DATE,
  metric_type TEXT,
  delivered_count BIGINT,
  charged_count BIGINT,
  missing_count BIGINT,
  should_charge_credits NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  
  -- Missing impression charges
  SELECT 
    c.id AS campaign_id,
    DATE(imp.created_at) AS day,
    'impression'::TEXT AS metric_type,
    COUNT(imp.id) AS delivered_count,
    COALESCE(SUM(ledger.quantity), 0) AS charged_count,
    COUNT(imp.id) - COALESCE(SUM(ledger.quantity), 0) AS missing_count,
    -- ✅ FIXED: Use bid_cents with correct conversion
    -- Based on Oct 30: bid_cents 500 = 1.00 credit per impression
    -- Formula: credits_per_impression = bid_cents / 500
    ((COUNT(imp.id) - COALESCE(SUM(ledger.quantity), 0)) * 
     COALESCE((c.bidding->>'bid_cents')::NUMERIC, 0) / 500) AS should_charge_credits
  FROM campaigns.campaigns c
  INNER JOIN campaigns.ad_impressions imp ON imp.campaign_id = c.id
  LEFT JOIN campaigns.ad_spend_ledger ledger 
    ON ledger.campaign_id = c.id 
    AND DATE(ledger.occurred_at) = DATE(imp.created_at)
    AND ledger.metric_type = 'impression'
  WHERE 
    (p_campaign_id IS NULL OR c.id = p_campaign_id)
    AND imp.created_at >= CURRENT_DATE - p_lookback_days
    AND imp.created_at < NOW() - INTERVAL '5 minutes'  -- Give time for normal charging
  GROUP BY c.id, DATE(imp.created_at)
  HAVING COUNT(imp.id) - COALESCE(SUM(ledger.quantity), 0) > 0
  
  UNION ALL
  
  -- Missing click charges (if CPC model is used)
  SELECT 
    c.id AS campaign_id,
    DATE(clk.created_at) AS day,
    'click'::TEXT AS metric_type,
    COUNT(clk.id) AS delivered_count,
    COALESCE(SUM(ledger.quantity), 0) AS charged_count,
    COUNT(clk.id) - COALESCE(SUM(ledger.quantity), 0) AS missing_count,
    -- For CPC: might use a different field, adjust as needed
    ((COUNT(clk.id) - COALESCE(SUM(ledger.quantity), 0)) * 
     COALESCE((c.bidding->>'cpc_credits')::NUMERIC, 
              (c.bidding->>'bid_cents')::NUMERIC / 500, 0)) AS should_charge_credits
  FROM campaigns.campaigns c
  INNER JOIN campaigns.ad_clicks clk ON clk.campaign_id = c.id
  LEFT JOIN campaigns.ad_spend_ledger ledger 
    ON ledger.campaign_id = c.id 
    AND DATE(ledger.occurred_at) = DATE(clk.created_at)
    AND ledger.metric_type = 'click'
  WHERE 
    (p_campaign_id IS NULL OR c.id = p_campaign_id)
    AND clk.created_at >= CURRENT_DATE - p_lookback_days
    AND clk.created_at < NOW() - INTERVAL '5 minutes'
    AND c.bidding->>'model' = 'CPC'  -- Only for CPC campaigns
  GROUP BY c.id, DATE(clk.created_at)
  HAVING COUNT(clk.id) - COALESCE(SUM(ledger.quantity), 0) > 0;
  
END;
$$;

-- Test the fix
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

-- Expected: Should now show 1.00 credits for Oct 28 missing impression

