-- Check the event_posts table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'events'
  AND table_name = 'event_posts'
ORDER BY ordinal_position;

