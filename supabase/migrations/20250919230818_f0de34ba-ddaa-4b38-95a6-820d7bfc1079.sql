-- Fix the materialized view refresh issue
DROP MATERIALIZED VIEW IF EXISTS public.search_docs_mv;

-- Check if there are any problematic materialized views
SELECT schemaname, matviewname, ispopulated 
FROM pg_matviews 
WHERE schemaname = 'public';