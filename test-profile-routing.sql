-- Test Profile Routing
-- Verify that "rodzrj" username resolves correctly

-- 1. Find user by username "rodzrj"
SELECT 
  user_id,
  display_name,
  username,
  photo_url,
  role
FROM user_profiles
WHERE username ILIKE 'rodzrj'
LIMIT 1;

-- 2. Verify Roderick Moodie's profile exists
SELECT 
  user_id,
  display_name,
  username,
  photo_url,
  role,
  (SELECT COUNT(*) FROM event_posts WHERE author_user_id = up.user_id) as post_count,
  (SELECT COUNT(*) FROM tickets WHERE owner_user_id = up.user_id) as ticket_count
FROM user_profiles up
WHERE display_name ILIKE '%roderick%'
LIMIT 5;

