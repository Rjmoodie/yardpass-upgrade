-- Fix 1: Force refresh materialized view to get correct spend
REFRESH MATERIALIZED VIEW CONCURRENTLY public.analytics_campaign_daily_mv;

-- Fix 2: Check if spend is correct in the view
SELECT 
  campaign_id,
  day,
  impressions,
  clicks,
  spend_credits,
  ctr,
  ecpm,
  cpc
FROM public.analytics_campaign_daily_mv
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC;

-- Fix 3: Check actual campaign spend (including accrual)
SELECT 
  id,
  spent_credits,
  spend_accrual,
  (spent_credits + spend_accrual) AS total_spend,
  total_budget_credits
FROM campaigns.campaigns 
WHERE id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec';

-- Fix 4: Check dwell time in impressions table
SELECT 
  id,
  created_at,
  viewable,
  pct_visible,
  dwell_ms, -- Should be > 0 if tracked properly
  DATE(created_at) AS day
FROM campaigns.ad_impressions
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY created_at DESC;



