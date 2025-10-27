-- Test CPM accumulation by simulating multiple impressions

\echo '=== Before: Campaign Status ==='
SELECT 
  spent_credits,
  spend_accrual,
  total_budget_credits - spent_credits as remaining_budget
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

\echo ''
\echo '=== Simulating 500 impressions (should trigger 1 credit charge) ==='

DO $$
DECLARE
  i INT;
  result RECORD;
BEGIN
  FOR i IN 1..500 LOOP
    SELECT * INTO result FROM public.log_impression_and_charge(
      p_campaign_id := '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec',
      p_creative_id := 'cc3d6b97-2d18-4c08-bf2e-682a2f8e74bc',
      p_user_id := NULL,
      p_session_id := 'test-session-' || i::text,
      p_event_id := '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec',
      p_placement := 'feed',
      p_request_id := gen_random_uuid(),
      p_pricing_model := 'cpm',
      p_rate_credits := 2.0,
      p_bid_credits := 2.0,
      p_viewable := true,
      p_pct_visible := 100,
      p_dwell_ms := 2000,
      p_freq_cap := 3
    );
    
    -- Log progress every 100 impressions
    IF i % 100 = 0 THEN
      RAISE NOTICE 'Processed % impressions...', i;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Completed 500 impressions!';
END $$;

\echo ''
\echo '=== After: Campaign Status ==='
SELECT 
  spent_credits,
  spend_accrual,
  total_budget_credits - spent_credits as remaining_budget
FROM campaigns.campaigns
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

\echo ''
\echo '=== Ledger Entries ==='
SELECT 
  metric_type,
  quantity,
  rate_model,
  credits_charged,
  occurred_at
FROM campaigns.ad_spend_ledger
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY occurred_at DESC
LIMIT 10;

\echo ''
\echo '=== Final Summary ==='
SELECT 
  (SELECT COUNT(*) FROM campaigns.ad_impressions WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec') as total_impressions,
  (SELECT COALESCE(SUM(credits_charged), 0) FROM campaigns.ad_spend_ledger WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec') as total_charged,
  (SELECT spent_credits FROM campaigns.campaigns WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec') as campaign_spent,
  (SELECT spend_accrual FROM campaigns.campaigns WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec') as campaign_accrual;

