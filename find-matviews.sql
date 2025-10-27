-- Find all materialized views
SELECT 
  schemaname,
  matviewname,
  LEFT(definition, 200) AS definition_start
FROM pg_matviews
WHERE schemaname IN ('campaigns', 'public')
ORDER BY schemaname, matviewname;


