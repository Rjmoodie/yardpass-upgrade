-- =====================================================
-- SUPABASE STRUCTURE CHECKER
-- Purpose: Verify database structure before making changes
-- Date: 2025-01-03
-- =====================================================

-- 1. AVAILABLE SCHEMAS
SELECT '========== 1. AVAILABLE SCHEMAS ==========' AS section;
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
ORDER BY schema_name;

-- 2. WHERE IS THE EVENTS TABLE?
SELECT '========== 2. WHERE IS THE EVENTS TABLE? ==========' AS section;
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'events'
ORDER BY table_schema;

-- 3. EVENTS TABLE COLUMNS
SELECT '========== 3. EVENTS TABLE COLUMNS ==========' AS section;
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'events' AND table_name = 'events'
ORDER BY ordinal_position;

-- 4. PUBLIC.EVENTS VIEW (for PostgREST)
SELECT '========== 4. PUBLIC.EVENTS VIEW (for PostgREST) ==========' AS section;
SELECT 
  schemaname,
  viewname,
  'VIEW EXISTS' as status
FROM pg_views 
WHERE viewname = 'events' AND schemaname = 'public';

-- 5. TICKET_TIERS TABLE LOCATION
SELECT '========== 5. TICKET_TIERS TABLE LOCATION ==========' AS section;
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name = 'ticket_tiers';

-- 6. TICKET_TIERS COLUMNS
SELECT '========== 6. TICKET_TIERS COLUMNS ==========' AS section;
SELECT 
  table_schema,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'ticket_tiers'
  AND table_schema IN ('public', 'ticketing')
ORDER BY table_schema, ordinal_position;

-- 7. GET_HOME_FEED_RANKED FUNCTION
SELECT '========== 7. GET_HOME_FEED_RANKED FUNCTION ==========' AS section;
SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'get_home_feed_ranked'
ORDER BY n.nspname;

-- 8. GET_HOME_FEED_IDS FUNCTION
SELECT '========== 8. GET_HOME_FEED_IDS FUNCTION ==========' AS section;
SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'get_home_feed_ids'
ORDER BY n.nspname;

-- 9. NEW TABLES STATUS
SELECT '========== 9. NEW TABLES FROM MIGRATIONS ==========' AS section;
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_name IN (
  'event_addons',
  'checkout_questions', 
  'checkout_answers',
  'order_addons',
  'event_tags',
  'user_tag_preferences'
)
ORDER BY table_schema, table_name;

-- 10. NEW COLUMNS ON EVENTS
SELECT '========== 10. NEW COLUMNS ON EVENTS.EVENTS ==========' AS section;
SELECT 
  column_name,
  data_type,
  CASE 
    WHEN column_name IN ('tags', 'scheduled_publish_at', 'settings', 'search_vector') 
    THEN 'NEW COLUMN'
    ELSE 'Existing'
  END AS status
FROM information_schema.columns 
WHERE table_schema = 'events' AND table_name = 'events'
  AND column_name IN ('tags', 'scheduled_publish_at', 'settings', 'search_vector', 'title', 'description', 'category')
ORDER BY 
  CASE WHEN column_name IN ('tags', 'scheduled_publish_at', 'settings', 'search_vector') THEN 0 ELSE 1 END,
  column_name;

-- 11. NEW COLUMNS ON TICKET_TIERS
SELECT '========== 11. NEW COLUMNS ON TICKET_TIERS ==========' AS section;
SELECT 
  column_name,
  data_type,
  CASE 
    WHEN column_name IN ('fee_bearer', 'tier_visibility', 'requires_tier_id') 
    THEN 'NEW COLUMN'
    ELSE 'Existing'
  END AS status
FROM information_schema.columns 
WHERE table_name = 'ticket_tiers'
  AND column_name IN ('fee_bearer', 'tier_visibility', 'requires_tier_id', 'name', 'price_cents', 'status')
ORDER BY 
  CASE WHEN column_name IN ('fee_bearer', 'tier_visibility', 'requires_tier_id') THEN 0 ELSE 1 END,
  column_name;

-- 12. TAG-RELATED TRIGGERS
SELECT '========== 12. TAG-RELATED TRIGGERS ==========' AS section;
SELECT 
  n.nspname || '.' || c.relname AS table_name,
  t.tgname AS trigger_name,
  CASE t.tgenabled 
    WHEN 'O' THEN 'ENABLED'
    WHEN 'D' THEN 'DISABLED'
    ELSE t.tgenabled::text
  END AS status
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE t.tgname LIKE '%tag%' OR t.tgname LIKE '%search%'
ORDER BY n.nspname, c.relname, t.tgname;

-- 13. TAG-RELATED INDEXES
SELECT '========== 13. TAG-RELATED INDEXES ==========' AS section;
SELECT 
  schemaname || '.' || tablename AS table_name,
  indexname
FROM pg_indexes 
WHERE indexname LIKE '%tag%'
ORDER BY schemaname, tablename, indexname;

-- 14. SAMPLE DATA COUNTS
SELECT '========== 14. SAMPLE DATA COUNTS ==========' AS section;

SELECT 'Events with tags' AS check_type, COUNT(*) AS count
FROM events.events WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
UNION ALL
SELECT 'Event add-ons', COUNT(*) FROM ticketing.event_addons
UNION ALL
SELECT 'Checkout questions', COUNT(*) FROM ticketing.checkout_questions
UNION ALL
SELECT 'User tag preferences', COUNT(*) FROM public.user_tag_preferences
UNION ALL
SELECT 'Tag statistics', COUNT(*) FROM events.event_tags;

-- Done
SELECT '========== CHECK COMPLETE ==========' AS section;
