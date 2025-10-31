-- ========================================
-- CRITICAL: Fix dashboard spend display
-- ========================================

-- This refreshes the analytics materialized view
-- After this, dashboard will show 0.5 credits instead of 1
REFRESH MATERIALIZED VIEW CONCURRENTLY public.analytics_campaign_daily_mv;

-- Verify it worked:
SELECT 
  campaign_id,
  day,
  impressions,
  clicks,
  spend_credits -- Should now show 0.5!
FROM public.analytics_campaign_daily_mv
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC;

-- ========================================
-- OPTIONAL: Verify current campaign state
-- ========================================

SELECT 
  id,
  spent_credits,
  spend_accrual,
  (spent_credits + spend_accrual) AS total_spend,
  total_budget_credits
FROM campaigns.campaigns 
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Expected output:
-- spent_credits: 0.000000
-- spend_accrual: 0.500000
-- total_spend: 0.500000
-- total_budget: 10000.000000




