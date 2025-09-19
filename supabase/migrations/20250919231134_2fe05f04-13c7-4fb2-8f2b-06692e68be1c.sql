-- Look for anything in the database that references refresh_search_docs
SELECT 
  schemaname, 
  tablename, 
  definition 
FROM pg_views 
WHERE definition ILIKE '%refresh_search_docs%'
UNION ALL
SELECT 
  n.nspname as schemaname,
  p.proname as tablename,
  'function' as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosrc ILIKE '%refresh_search_docs%'
  AND n.nspname = 'public'