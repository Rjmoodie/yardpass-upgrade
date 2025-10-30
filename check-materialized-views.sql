-- Check what materialized views exist
SELECT 
  schemaname,
  matviewname,
  hasindexes,
  ispopulated
FROM pg_matviews
WHERE matviewname LIKE '%campaign%' OR matviewname LIKE '%analytics%'
ORDER BY schemaname, matviewname;

-- Check if analytics_campaign_daily_mv exists
SELECT 
  schemaname,
  matviewname,
  definition
FROM pg_matviews
WHERE matviewname = 'analytics_campaign_daily_mv';

