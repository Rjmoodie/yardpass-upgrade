-- Debug event_invites 403 error

-- 1. Check what RLS policies exist NOW
SELECT 
  '=== CURRENT RLS POLICIES ON event_invites ===' AS section,
  policyname,
  cmd AS command,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING'
    ELSE 'No USING'
  END AS has_using,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK'
    ELSE 'No WITH CHECK'
  END AS has_with_check
FROM pg_policies
WHERE schemaname = 'events'
  AND tablename = 'event_invites'
ORDER BY policyname;

-- 2. Test if you can call is_event_manager for a specific event
-- Replace with an actual event ID
SELECT 
  '=== TEST is_event_manager ===' AS section,
  'd98755ff-6996-4b8e-85b1-25e9323dd2ee' AS test_event_id,
  public.is_event_manager('d98755ff-6996-4b8e-85b1-25e9323dd2ee') AS result_should_be_true;

-- 3. Check if you're authenticated in this session
SELECT 
  '=== AUTH STATUS ===' AS section,
  auth.uid() AS your_user_id,
  CASE 
    WHEN auth.uid() IS NULL THEN '❌ NOT AUTHENTICATED - SQL Editor has no user context'
    ELSE '✅ Authenticated'
  END AS status;

-- 4. Try to manually test the INSERT permission
-- This will tell us if the WITH CHECK clause is working
SELECT 
  '=== INSERT PERMISSION TEST ===' AS section,
  'Run this in a separate query with the event ID you are trying to add guests to:' AS instruction,
  'SELECT public.is_event_manager(''YOUR_EVENT_ID_HERE'');' AS test_query;

