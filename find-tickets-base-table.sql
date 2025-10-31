-- Find the actual tickets table (not view)
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name LIKE '%ticket%'
  AND table_type = 'BASE TABLE'
ORDER BY table_schema, table_name;

-- Check if tickets is a view
SELECT 
  table_schema,
  table_name,
  view_definition
FROM information_schema.views
WHERE table_name = 'tickets';

