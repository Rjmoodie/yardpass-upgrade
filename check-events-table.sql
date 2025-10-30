-- Check which schema has the events table
SELECT 
  schemaname, 
  tablename,
  tableowner
FROM pg_tables 
WHERE tablename LIKE '%event%' 
  AND tablename NOT LIKE '%pg_%'
ORDER BY schemaname, tablename;

-- Also check for views
SELECT 
  schemaname, 
  viewname,
  viewowner
FROM pg_views 
WHERE viewname LIKE '%event%' 
  AND schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, viewname;

