-- Check what columns currently exist on events table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'events' 
  AND table_name = 'events'
ORDER BY ordinal_position;

-- Check if is_flashback already exists
SELECT column_name 
FROM information_schema.columns
WHERE table_schema = 'events' 
  AND table_name = 'events'
  AND column_name IN ('is_flashback', 'flashback_end_date', 'linked_event_id', 'flashback_explainer');

-- Check current get_home_feed_ids function signature
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'get_home_feed_ids';

-- Check what migrations have been applied
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 10;
