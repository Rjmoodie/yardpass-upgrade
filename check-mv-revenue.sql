-- Check the materialized view for revenue_cents
SELECT 
  day,
  impressions,
  clicks,
  conversions,
  conversion_value_cents,
  spend_credits
FROM analytics_campaign_daily_mv
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
ORDER BY day DESC;

