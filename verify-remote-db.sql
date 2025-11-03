-- Run this in Supabase Dashboard → SQL Editor
-- This will show you what's actually in your REMOTE database

-- 1. Check what migrations have been applied to REMOTE
SELECT version, name 
FROM supabase_migrations.schema_migrations 
ORDER BY version DESC 
LIMIT 20;

-- 2. Check if events.events table has flashback columns
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'events' 
  AND table_name = 'events'
  AND column_name IN ('is_flashback', 'flashback_end_date', 'linked_event_id', 'flashback_explainer', 'is_past', 'status');

-- 3. Check if event_posts has is_organizer_featured
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'events'
  AND table_name = 'event_posts'
  AND column_name = 'is_organizer_featured';

-- 4. Check if comment system is updated
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'events'
  AND table_name = 'event_comments'
  AND column_name IN ('is_pinned', 'parent_comment_id', 'mentions', 'reply_count');

-- 5. Check get_home_feed_ids function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_home_feed_ids', 'can_current_user_post', 'can_post_to_flashback');

-- ============================================================================
-- INTERPRETATION:
-- ============================================================================
-- If you see:
--   • 0 rows for flashback columns → Flashback NOT in remote DB yet
--   • 0 rows for is_organizer_featured → Post moderation NOT in remote DB yet
--   • 0-4 rows for comment columns → Comments may be partially/fully updated
--   • 1-3 rows for functions → Check which exist
--
-- This tells us EXACTLY what your remote database has!

