-- Find the base events table (not view)
SELECT 
  schemaname, 
  tablename
FROM pg_tables 
WHERE tablename LIKE '%event%' 
  AND tablename NOT LIKE '%pg_%'
  AND schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;

-- Also check the definition of the events view
SELECT pg_get_viewdef('public.events', true) AS view_definition;

