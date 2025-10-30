-- ========================================
-- FIX: Add rate_model to reconciliation
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
      -- ✅ FIXED: Added rate_model
      INSERT INTO campaigns.ad_spend_ledger (
        campaign_id,
        rate_model,
        metric_type,
        quantity,
        credits_charged,
        occurred_at
      )
      VALUES (
        v_missing_record.campaign_id,
        CASE 
          WHEN v_missing_record.metric_type = 'impression' THEN 'cpm'
          WHEN v_missing_record.metric_type = 'click' THEN 'cpc'
          ELSE 'cpm'
        END,
        v_missing_record.metric_type,
        v_missing_record.missing_count,
        v_missing_record.should_charge_credits,
        v_missing_record.day
      );
      
      v_ledger_count := v_ledger_count + 1;
      
      -- Update campaign spent_credits
      UPDATE campaigns.campaigns
      SET spent_credits = spent_credits + v_missing_record.should_charge_credits
      WHERE id = v_missing_record.campaign_id;
      
      v_campaigns_count := v_campaigns_count + 1;
    END IF;
  END LOOP;
  
  -- Log the reconciliation (only if changes were made)
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

-- Now apply the reconciliation
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
  FALSE  -- Apply changes for real
);

-- Verify the fix
SELECT 
  rate_model,
  metric_type,
  quantity,
  credits_charged,
  DATE(occurred_at) AS day
FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY occurred_at DESC
LIMIT 3;

