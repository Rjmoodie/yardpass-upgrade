-- Remove the function that references the deleted materialized view
DROP FUNCTION IF EXISTS public.refresh_search_docs();