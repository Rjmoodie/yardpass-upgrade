-- Check which schema event_comments is actually in
SELECT 
  table_schema,
  table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'event_comments'
GROUP BY table_schema, table_name;

-- Check all columns in event_comments (wherever it is)
SELECT 
  table_schema,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'event_comments'
ORDER BY table_schema, ordinal_position;
