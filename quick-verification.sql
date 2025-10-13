-- QUICK VERIFICATION SCRIPT
-- Run this to quickly check if migration was successful
-- Expected time: < 5 seconds

\echo '=== QUICK MIGRATION VERIFICATION ==='
\echo ''

-- 1. Enum check
\echo '1. Checking follow_target enum...'
SELECT enum_range(NULL::follow_target) as follow_targets;
\echo '   ✓ Should include: {organizer,event,user}'
\echo ''

-- 2. Column checks
\echo '2. Checking new columns...'
SELECT 
  CASE WHEN COUNT(*) = 3 THEN '   ✓ All 3 columns exist in user_profiles' 
       ELSE '   ✗ Missing columns!' END as result
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND column_name IN ('bio', 'photo_url', 'location');
\echo ''

SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'follows' AND column_name = 'status'
  ) THEN '   ✓ Status column exists in follows'
     ELSE '   ✗ Status column missing!' END as result;
\echo ''

-- 3. View checks
\echo '3. Checking views...'
SELECT 
  CASE WHEN COUNT(*) = 2 THEN '   ✓ Both views created' 
       ELSE '   ✗ Missing views!' END as result
FROM pg_views 
WHERE schemaname = 'public'
  AND viewname IN ('follow_profiles', 'user_search');
\echo ''

-- 4. Function checks
\echo '4. Checking functions...'
SELECT 
  CASE WHEN COUNT(*) >= 2 THEN '   ✓ Helper functions exist' 
       ELSE '   ✗ Missing functions!' END as result
FROM pg_proc 
WHERE proname IN ('get_user_connections', 'get_mutual_connections');
\echo ''

-- 5. Data check
\echo '5. Checking data...'
SELECT 
  COUNT(*) as total_users,
  CASE WHEN COUNT(*) > 0 THEN '   ✓ Users exist' ELSE '   ✗ No users yet' END as status
FROM user_profiles;

SELECT 
  CASE WHEN COUNT(*) > 0 THEN '   ✓ Some users have profile data'
       ELSE '   ℹ No profile data yet (expected for new system)' END as result
FROM user_profiles
WHERE bio IS NOT NULL OR photo_url IS NOT NULL OR location IS NOT NULL;
\echo ''

-- 6. Test user_search view
\echo '6. Testing user_search view...'
SELECT 
  COUNT(*) as rows_in_view,
  CASE WHEN COUNT(*) > 0 THEN '   ✓ View returns data' 
       ELSE '   ✗ View is empty' END as status
FROM user_search;
\echo ''

-- 7. Index check
\echo '7. Checking indexes...'
SELECT 
  CASE WHEN COUNT(*) >= 3 THEN '   ✓ User following indexes created' 
       ELSE '   ✗ Missing indexes!' END as result
FROM pg_indexes
WHERE tablename = 'follows'
  AND indexname LIKE '%user%';
\echo ''

-- 8. Policy check
\echo '8. Checking RLS policies...'
SELECT 
  CASE WHEN COUNT(*) >= 3 THEN '   ✓ User following policies exist' 
       ELSE '   ✗ Missing policies!' END as result
FROM pg_policies
WHERE tablename = 'follows'
  AND (policyname LIKE '%user%' OR policyname LIKE '%follow%');
\echo ''

\echo '=== VERIFICATION COMPLETE ==='
\echo ''
\echo 'If all checks show ✓ then migration was SUCCESSFUL!'
\echo ''
\echo 'Next steps:'
\echo '  1. Run populate-test-user-data.sql to add sample data'
\echo '  2. Test the /social page in your app'
\echo '  3. Try following another user'
\echo ''

