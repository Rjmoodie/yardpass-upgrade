-- Quick Verification Script
-- Run this to check if migration will work BEFORE deploying

-- ==========================================
-- STEP 1: Check current schema
-- ==========================================

-- Check if new tables already exist (shouldn't)
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_detail_views') 
    THEN '⚠️  ticket_detail_views already exists'
    ELSE '✅ ticket_detail_views will be created'
  END AS ticket_views_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profile_visits') 
    THEN '⚠️  profile_visits already exists'
    ELSE '✅ profile_visits will be created'
  END AS profile_visits_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'model_feature_weights') 
    THEN '⚠️  model_feature_weights already exists'
    ELSE '✅ model_feature_weights will be created'
  END AS weights_status;

-- ==========================================
-- STEP 2: Check current feed function
-- ==========================================

-- Check current function signature
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_home_feed_ranked', 'get_home_feed_ids')
ORDER BY routine_name;

-- Expected: Should show current functions (will be replaced)

-- ==========================================
-- STEP 3: Check for required dependencies
-- ==========================================

-- Check required tables exist
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'events') 
    THEN '✅ events' ELSE '❌ events MISSING' END AS events_check,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_posts') 
    THEN '✅ event_posts' ELSE '❌ event_posts MISSING' END AS posts_check,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') 
    THEN '✅ tickets' ELSE '❌ tickets MISSING' END AS tickets_check,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_events') 
    THEN '✅ saved_events' ELSE '❌ saved_events MISSING' END AS saved_check,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'events' AND table_name = 'event_impressions') 
    THEN '✅ event_impressions' ELSE '❌ event_impressions MISSING' END AS impressions_check,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follows') 
    THEN '✅ follows' ELSE '⚠️  follows MISSING (optional)' END AS follows_check;

-- ==========================================
-- STEP 4: Check if we have test data
-- ==========================================

SELECT 
  (SELECT COUNT(*) FROM events WHERE visibility = 'public' AND start_at > now()) AS future_events,
  (SELECT COUNT(*) FROM auth.users) AS total_users,
  (SELECT COUNT(*) FROM saved_events) AS saved_events_count,
  (SELECT COUNT(*) FROM tickets WHERE status IN ('issued', 'transferred', 'redeemed')) AS issued_tickets;

-- Expected: All > 0 for meaningful testing

-- ==========================================
-- STEP 5: Space check
-- ==========================================

-- Check database size (ensure we have room)
SELECT 
  pg_size_pretty(pg_database_size(current_database())) AS current_db_size,
  pg_size_pretty(pg_database_size(current_database()) * 1.1) AS estimated_after_migration;

-- ==========================================
-- VERIFICATION SUMMARY
-- ==========================================

SELECT 
  '✅ Run this script in Supabase SQL Editor' AS step_1,
  '✅ Check all statuses above are green' AS step_2,
  '✅ If any ❌ or ⚠️, fix dependencies first' AS step_3,
  '✅ Then run: supabase db push' AS step_4;

