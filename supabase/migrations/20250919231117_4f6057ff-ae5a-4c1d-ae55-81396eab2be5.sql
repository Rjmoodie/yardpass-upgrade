-- Check for any other functions that might call refresh_search_docs
SELECT 
  p.proname,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) ILIKE '%refresh_search_docs%'
  AND n.nspname = 'public'