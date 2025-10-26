-- Check the organizations table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'organizations'
  AND table_name = 'organizations'
ORDER BY ordinal_position;

