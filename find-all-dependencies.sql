-- Find ALL dependencies on campaigns.campaigns table
SELECT 
  'materialized_views' AS type,
  schemaname,
  matviewname AS name,
  definition
FROM pg_matviews
WHERE schemaname = 'campaigns'
UNION ALL
SELECT 
  'views' AS type,
  schemaname,
  viewname AS name,
  definition
FROM pg_views
WHERE definition LIKE '%campaigns.campaigns%'
   OR definition LIKE '%spent_credits%'
   OR definition LIKE '%total_budget_credits%'
ORDER BY type, name;

-- Also check for any table that might have been misnamed as a view
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'campaigns'
ORDER BY table_name;


