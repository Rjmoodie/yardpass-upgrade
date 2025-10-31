-- Check for event_impressions table
SELECT 
  schemaname,
  tablename
FROM pg_tables
WHERE tablename LIKE '%impression%'
ORDER BY schemaname, tablename;

-- Check for notifications table
SELECT 
  schemaname,
  tablename
FROM pg_tables
WHERE tablename LIKE '%notification%'
ORDER BY schemaname, tablename;

-- Check all analytics/events schemas
SELECT 
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname IN ('public', 'events', 'analytics', 'campaigns')
  AND tablename LIKE '%event%'
ORDER BY schemaname, tablename;


