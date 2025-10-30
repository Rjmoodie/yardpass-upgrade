-- ========================================
-- RECONCILIATION SYSTEM
-- ========================================
-- Automatically detect and fix missing charges for delivered ads

-- ========================================
-- 1. Create reconciliation log table
-- ========================================
CREATE TABLE IF NOT EXISTS campaigns.reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns.campaigns(id),
  reconciliation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- What was found
  missing_impressions INT DEFAULT 0,
  missing_clicks INT DEFAULT 0,
  missing_conversions INT DEFAULT 0,
  
  -- What was fixed
  credits_charged NUMERIC DEFAULT 0,
  ledger_entries_created INT DEFAULT 0,
  
  -- Details
  notes TEXT,
  details JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recon_log_campaign ON campaigns.reconciliation_log(campaign_id);
CREATE INDEX idx_recon_log_date ON campaigns.reconciliation_log(reconciliation_date DESC);

-- ========================================
-- 2. Function to find missing charges
-- ========================================
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
    ((COUNT(imp.id) - COALESCE(SUM(ledger.quantity), 0)) * 
     COALESCE((c.bidding->>'cpm_credits')::NUMERIC, 0) / 1000) AS should_charge_credits
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
  
  -- Missing click charges (if you charge for clicks)
  SELECT 
    c.id AS campaign_id,
    DATE(clk.created_at) AS day,
    'click'::TEXT AS metric_type,
    COUNT(clk.id) AS delivered_count,
    COALESCE(SUM(ledger.quantity), 0) AS charged_count,
    COUNT(clk.id) - COALESCE(SUM(ledger.quantity), 0) AS missing_count,
    ((COUNT(clk.id) - COALESCE(SUM(ledger.quantity), 0)) * 
     COALESCE((c.bidding->>'cpc_credits')::NUMERIC, 0)) AS should_charge_credits
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
    AND COALESCE((c.bidding->>'cpc_credits')::NUMERIC, 0) > 0  -- Only if CPC charging enabled
  GROUP BY c.id, DATE(clk.created_at)
  HAVING COUNT(clk.id) - COALESCE(SUM(ledger.quantity), 0) > 0;
  
END;
$$;

-- ========================================
-- 3. Function to apply reconciliation
-- ========================================
CREATE OR REPLACE FUNCTION campaigns.reconcile_missing_charges(
  p_campaign_id UUID DEFAULT NULL,
  p_lookback_days INT DEFAULT 7,
  p_dry_run BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  campaign_id UUID,
  total_missing_impressions BIGINT,
  total_missing_clicks BIGINT,
  total_credits_charged NUMERIC,
  ledger_entries_created INT,
  campaigns_updated INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_missing_record RECORD;
  v_total_impressions BIGINT := 0;
  v_total_clicks BIGINT := 0;
  v_total_credits NUMERIC := 0;
  v_ledger_count INT := 0;
  v_campaigns_count INT := 0;
  v_log_id UUID;
BEGIN
  -- Find missing charges
  FOR v_missing_record IN 
    SELECT * FROM campaigns.find_missing_charges(p_campaign_id, p_lookback_days)
  LOOP
    -- Track totals
    IF v_missing_record.metric_type = 'impression' THEN
      v_total_impressions := v_total_impressions + v_missing_record.missing_count;
    ELSIF v_missing_record.metric_type = 'click' THEN
      v_total_clicks := v_total_clicks + v_missing_record.missing_count;
    END IF;
    
    v_total_credits := v_total_credits + v_missing_record.should_charge_credits;
    
    -- Apply fix (unless dry run)
    IF NOT p_dry_run AND v_missing_record.should_charge_credits > 0 THEN
      -- Create ledger entry
      INSERT INTO campaigns.ad_spend_ledger (
        campaign_id,
        metric_type,
        quantity,
        credits_charged,
        occurred_at,
        notes
      )
      VALUES (
        v_missing_record.campaign_id,
        v_missing_record.metric_type,
        v_missing_record.missing_count,
        v_missing_record.should_charge_credits,
        v_missing_record.day,
        'Reconciliation: retroactive charge for missing ' || v_missing_record.metric_type || 's'
      );
      
      v_ledger_count := v_ledger_count + 1;
      
      -- Update campaign spent_credits
      UPDATE campaigns.campaigns
      SET spent_credits = spent_credits + v_missing_record.should_charge_credits
      WHERE id = v_missing_record.campaign_id;
      
      v_campaigns_count := v_campaigns_count + 1;
    END IF;
  END LOOP;
  
  -- Log the reconciliation
  IF NOT p_dry_run AND (v_total_impressions > 0 OR v_total_clicks > 0) THEN
    INSERT INTO campaigns.reconciliation_log (
      campaign_id,
      missing_impressions,
      missing_clicks,
      credits_charged,
      ledger_entries_created,
      notes
    )
    VALUES (
      p_campaign_id,
      v_total_impressions,
      v_total_clicks,
      v_total_credits,
      v_ledger_count,
      CASE 
        WHEN p_dry_run THEN 'DRY RUN: No changes applied'
        ELSE 'Reconciliation completed successfully'
      END
    );
  END IF;
  
  -- Return summary
  RETURN QUERY SELECT 
    p_campaign_id,
    v_total_impressions,
    v_total_clicks,
    v_total_credits,
    v_ledger_count,
    v_campaigns_count;
END;
$$;

-- ========================================
-- 4. Scheduled job (via pg_cron)
-- ========================================
COMMENT ON FUNCTION campaigns.reconcile_missing_charges IS 
'Run this function via pg_cron every hour:
SELECT cron.schedule(
  ''reconcile-charges'',
  ''0 * * * *'',  -- Every hour
  $$SELECT campaigns.reconcile_missing_charges(NULL, 7, FALSE)$$
);';

-- ========================================
-- 5. Manual trigger function for UI
-- ========================================
CREATE OR REPLACE FUNCTION public.trigger_campaign_reconciliation(
  p_campaign_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Check user has access to this campaign
  IF NOT EXISTS (
    SELECT 1 FROM campaigns.campaigns c
    WHERE c.id = p_campaign_id
    AND c.org_id IN (
      SELECT org_id FROM public.org_memberships 
      WHERE user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Run reconciliation
  SELECT * INTO v_result
  FROM campaigns.reconcile_missing_charges(p_campaign_id, 7, FALSE)
  LIMIT 1;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'missing_impressions', v_result.total_missing_impressions,
    'missing_clicks', v_result.total_missing_clicks,
    'credits_charged', v_result.total_credits_charged,
    'ledger_entries_created', v_result.ledger_entries_created
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trigger_campaign_reconciliation TO authenticated;

-- ========================================
-- 6. View for monitoring
-- ========================================
CREATE OR REPLACE VIEW public.reconciliation_summary AS
SELECT 
  c.id AS campaign_id,
  c.name AS campaign_name,
  c.org_id,
  rl.reconciliation_date,
  rl.missing_impressions,
  rl.missing_clicks,
  rl.credits_charged,
  rl.notes
FROM campaigns.reconciliation_log rl
JOIN campaigns.campaigns c ON c.id = rl.campaign_id
ORDER BY rl.reconciliation_date DESC;

GRANT SELECT ON public.reconciliation_summary TO authenticated;

-- ========================================
-- Test: Find missing charges for your campaign
-- ========================================
-- Run this to see what's missing:
-- SELECT * FROM campaigns.find_missing_charges('3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec', 7);

-- Run this to apply fixes (DRY RUN first!):
-- SELECT * FROM campaigns.reconcile_missing_charges('3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec', 7, TRUE);

