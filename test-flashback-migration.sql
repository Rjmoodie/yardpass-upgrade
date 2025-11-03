-- Quick test script for flashback migration
-- Run this AFTER: supabase db push

-- 1. Verify columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'events' 
  AND table_name = 'events'
  AND column_name IN ('is_flashback', 'flashback_end_date', 'linked_event_id', 'flashback_explainer');

-- 2. Verify event_posts column
SELECT 
  column_name, 
  data_type
FROM information_schema.columns
WHERE table_schema = 'events' 
  AND table_name = 'event_posts'
  AND column_name = 'is_organizer_featured';

-- 3. Test functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('can_post_to_flashback', 'is_flashback_posting_open', 'get_flashback_stats', 'can_current_user_post');

-- 4. Test trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'events'
  AND trigger_name = 'trg_calculate_flashback_end_date';

-- ✅ Expected: 4 rows, 1 row, 4 rows, 1 row respectively

