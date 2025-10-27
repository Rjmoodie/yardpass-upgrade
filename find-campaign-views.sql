-- Find all views in campaigns schema that depend on these columns
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'campaigns'
ORDER BY viewname;


