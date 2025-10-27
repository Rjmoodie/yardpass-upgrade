-- Find the organization membership table
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name LIKE '%org%member%' OR table_name LIKE '%organization%member%'
ORDER BY table_schema, table_name;

-- Also check for any org-related tables
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema IN ('public', 'organizations')
  AND table_name LIKE '%org%'
ORDER BY table_schema, table_name;

