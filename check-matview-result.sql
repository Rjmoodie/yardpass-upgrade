-- Check if the materialized view now shows the correct spend
SELECT 
  campaign_id,
  day,
  impressions,
  clicks,
  spend_credits, -- This should now be 0.5!
  ctr,
  ecpm,
  cpc
FROM public.analytics_campaign_daily_mv
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC;

-- If this shows spend_credits = 0.5, the fix worked!
-- If it still shows 1.0 or 0, run the REFRESH command again.




