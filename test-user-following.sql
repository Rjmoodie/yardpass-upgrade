-- Comprehensive test script for user following system
-- Run this step-by-step to verify everything works

-- ============================================
-- STEP 1: Verify Schema Changes
-- ============================================

-- Check enum has 'user' value
SELECT 'Checking follow_target enum...' as step;
SELECT enum_range(NULL::follow_target) as values;
-- Expected: {organizer,event,user}

-- Check user_profiles has new columns
SELECT 'Checking user_profiles columns...' as step;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND column_name IN ('bio', 'photo_url', 'location', 'display_name');

-- Check follows has status column
SELECT 'Checking follows status column...' as step;
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'follows' 
  AND column_name = 'status';

-- ============================================
-- STEP 2: Check Current Data
-- ============================================

-- Count user profiles
SELECT 'Checking user_profiles data...' as step;
SELECT 
  COUNT(*) as total_users,
  COUNT(display_name) as users_with_names,
  COUNT(bio) as users_with_bio,
  COUNT(photo_url) as users_with_photo
FROM user_profiles;

-- Count existing follows by type
SELECT 'Checking existing follows...' as step;
SELECT 
  target_type,
  COUNT(*) as count,
  COUNT(DISTINCT follower_user_id) as unique_followers,
  COUNT(status) as follows_with_status
FROM follows
GROUP BY target_type;

-- ============================================
-- STEP 3: Test Views
-- ============================================

-- Test user_search view
SELECT 'Testing user_search view...' as step;
SELECT 
  user_id,
  display_name,
  COALESCE(bio, '(no bio)') as bio,
  COALESCE(photo_url, '(no photo)') as photo_url,
  follower_count,
  following_count,
  current_user_follow_status
FROM user_search
LIMIT 5;

-- Test follow_profiles view with existing follows
SELECT 'Testing follow_profiles view...' as step;
SELECT 
  f.id,
  f.follower_user_id,
  f.target_type,
  f.status,
  COALESCE(f.target_name, '(no name)') as target_name,
  COALESCE(f.follower_name, '(no name)') as follower_name
FROM follow_profiles f
LIMIT 5;

-- ============================================
-- STEP 4: Test Functions
-- ============================================

-- Test get_user_connections (pick a real user_id)
SELECT 'Testing get_user_connections...' as step;
DO $$
DECLARE
  test_user_id UUID;
BEGIN
  -- Get first user
  SELECT user_id INTO test_user_id FROM user_profiles LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    RAISE NOTICE 'Testing with user_id: %', test_user_id;
    
    -- This would work in a SELECT context
    PERFORM get_user_connections(test_user_id);
  ELSE
    RAISE NOTICE 'No users found in user_profiles table';
  END IF;
END $$;

-- Actually call the function
SELECT 
  connection_type,
  connection_name,
  connection_count
FROM get_user_connections(
  (SELECT user_id FROM user_profiles LIMIT 1)
)
WHERE EXISTS (SELECT 1 FROM user_profiles LIMIT 1)
LIMIT 10;

-- ============================================
-- STEP 5: Test RLS Policies
-- ============================================

-- Check policies exist
SELECT 'Checking RLS policies...' as step;
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'follows'
ORDER BY policyname;

-- ============================================
-- STEP 6: Simulate User-to-User Follow
-- ============================================

-- Show what a user follow would look like (READ ONLY)
SELECT 'Simulating user-to-user follow...' as step;
WITH test_users AS (
  SELECT 
    user_id,
    display_name,
    ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM user_profiles
  LIMIT 2
)
SELECT 
  'This is what a user follow would look like:' as description,
  u1.user_id as follower_user_id,
  u1.display_name as follower_name,
  'user'::follow_target as target_type,
  u2.user_id as target_id,
  u2.display_name as target_name,
  'pending'::TEXT as status,
  'User-to-user follows require approval' as note
FROM test_users u1
CROSS JOIN test_users u2
WHERE u1.rn = 1 AND u2.rn = 2;

-- ============================================
-- STEP 7: Check Indexes
-- ============================================

SELECT 'Checking indexes...' as step;
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'follows'
  AND (indexname LIKE '%user%' OR indexname LIKE '%follows%')
ORDER BY indexname;

-- ============================================
-- STEP 8: Check Triggers
-- ============================================

SELECT 'Checking triggers...' as step;
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'follows'
ORDER BY trigger_name;

-- ============================================
-- STEP 9: Verify Notification Function
-- ============================================

SELECT 'Checking notification function...' as step;
SELECT 
  proname,
  pronargs,
  prorettype::regtype
FROM pg_proc
WHERE proname = 'notify_user_follow';

-- ============================================
-- SUMMARY
-- ============================================

SELECT '
==============================================
MIGRATION VERIFICATION SUMMARY
==============================================

✓ Check if follow_target enum includes "user"
✓ Check if user_profiles has bio, photo_url, location
✓ Check if follows has status column
✓ Check if user_search view exists and returns data
✓ Check if follow_profiles view exists and returns data
✓ Check if get_user_connections function works
✓ Check if get_mutual_connections function exists
✓ Check if RLS policies are in place
✓ Check if indexes were created
✓ Check if notification trigger exists

If all queries above returned expected results,
the migration was successful!

Next steps:
1. Add some test data to user_profiles (bio, photo_url, location)
2. Test creating a user-to-user follow via the app
3. Verify notifications work
4. Test the Social page in the UI

==============================================
' as summary;

