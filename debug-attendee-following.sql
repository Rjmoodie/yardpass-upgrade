-- Debug script to verify attendee following migration
-- Run this to check if everything is set up correctly

-- 1. Check if 'user' was added to follow_target enum
SELECT enum_range(NULL::follow_target) as follow_target_values;
-- Expected: {organizer,event,user}

-- 2. Check if status column exists in follows table
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'follows' 
ORDER BY ordinal_position;

-- 3. Check if new columns exist in user_profiles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND column_name IN ('bio', 'photo_url', 'location');

-- 4. Check if views were created
SELECT viewname 
FROM pg_views 
WHERE schemaname = 'public' 
  AND viewname IN ('follow_profiles', 'user_search');

-- 5. Check if functions were created
SELECT proname 
FROM pg_proc 
WHERE proname IN ('get_user_connections', 'get_mutual_connections', 'notify_user_follow');

-- 6. Check if indexes were created
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'follows' 
  AND indexname LIKE '%user%';

-- 7. Check if RLS policies exist for user following
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'follows' 
  AND policyname LIKE '%user%';

-- 8. Test user_search view (should return all users)
SELECT 
  user_id,
  display_name,
  bio,
  photo_url,
  location,
  follower_count,
  following_count,
  current_user_follow_status
FROM user_search
LIMIT 5;

-- 9. Test follow_profiles view (should return existing follows)
SELECT 
  id,
  follower_user_id,
  target_type,
  target_id,
  status,
  target_name,
  target_photo,
  follower_name
FROM follow_profiles
LIMIT 5;

-- 10. Check if there are any existing follows
SELECT 
  target_type,
  COUNT(*) as count,
  COUNT(DISTINCT follower_user_id) as unique_followers
FROM follows
GROUP BY target_type;

-- 11. Check if any user profiles have the new fields populated
SELECT 
  COUNT(*) as total_profiles,
  COUNT(bio) as profiles_with_bio,
  COUNT(photo_url) as profiles_with_photo,
  COUNT(location) as profiles_with_location
FROM user_profiles;

-- 12. Try to simulate a user-to-user follow (read-only, won't insert)
-- This shows what a follow insert would look like
SELECT 
  'Expected follow structure:' as info,
  gen_random_uuid() as id,
  (SELECT user_id FROM user_profiles LIMIT 1) as follower_user_id,
  'user'::follow_target as target_type,
  (SELECT user_id FROM user_profiles OFFSET 1 LIMIT 1) as target_id,
  'pending' as status,
  now() as created_at
WHERE EXISTS (SELECT 1 FROM user_profiles LIMIT 2);

-- 13. Check triggers
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'follows'
  AND trigger_name LIKE '%follow%';

