-- Check what columns actually exist in the materialized view

SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_name = 'analytics_campaign_daily_mv'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Also check a sample row to see the data
SELECT * 
FROM public.analytics_campaign_daily_mv 
WHERE campaign_id = '3a51d5c9-b817-4c11-859f-5cd0b4c5b1ec'
LIMIT 1;


