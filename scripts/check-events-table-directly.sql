-- Bypass the view and check the actual events table

-- 1. Check if events.events table exists
SELECT 
  '=== EVENTS TABLE CHECK ===' AS section,
  schemaname,
  tablename
FROM pg_tables
WHERE tablename = 'events'
ORDER BY schemaname;

-- 2. Try to query events.events directly (might fail due to RLS)
SELECT 
  '=== DIRECT TABLE QUERY (events.events) ===' AS section,
  id AS event_id,
  title,
  created_by,
  owner_context_type,
  owner_context_id,
  CASE WHEN created_by = auth.uid() THEN '✅ You created this' ELSE '❌ Not yours' END AS creator_check
FROM events.events
WHERE created_by = auth.uid()
ORDER BY created_at DESC
LIMIT 10;

-- 3. Check public.events view definition
SELECT 
  '=== PUBLIC EVENTS VIEW DEFINITION ===' AS section,
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE viewname = 'events'
  AND schemaname = 'public';

-- 4. Check RLS policies on events.events table
SELECT 
  '=== RLS POLICIES ON events.events ===' AS section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS command,
  qual AS using_expression
FROM pg_policies
WHERE schemaname = 'events'
  AND tablename = 'events'
ORDER BY policyname;

-- 5. Check if you're authenticated
SELECT 
  '=== AUTH CHECK ===' AS section,
  auth.uid() AS your_user_id,
  CASE WHEN auth.uid() IS NOT NULL THEN '✅ Authenticated' ELSE '❌ Not authenticated' END AS auth_status;

-- 6. Count total events in the database (may fail)
SELECT 
  '=== TOTAL EVENT COUNT ===' AS section,
  COUNT(*) AS total_events
FROM events.events;

