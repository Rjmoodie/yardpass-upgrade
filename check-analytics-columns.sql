-- Check what columns exist in analytics_campaign_daily
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'analytics_campaign_daily'
  AND table_schema = 'public'
ORDER BY ordinal_position;

