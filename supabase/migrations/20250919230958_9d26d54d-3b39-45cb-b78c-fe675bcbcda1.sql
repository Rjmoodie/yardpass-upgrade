-- Check if refresh_analytics_views function is trying to refresh the non-existing view
SELECT p.proname, pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname ILIKE '%refresh%' AND n.nspname = 'public';