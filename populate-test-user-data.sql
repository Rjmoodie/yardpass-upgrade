-- Populate test data for user following system
-- This adds sample bios, photos, and locations to existing users
-- Run this to test that the views and functions work correctly

-- ============================================
-- Update existing user profiles with test data
-- ============================================

-- Update first 5 users with sample data
WITH sample_users AS (
  SELECT 
    user_id,
    display_name,
    ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM user_profiles
  LIMIT 5
)
UPDATE user_profiles up
SET 
  bio = CASE (SELECT rn FROM sample_users WHERE user_id = up.user_id)
    WHEN 1 THEN 'Music lover and event enthusiast. Always looking for the next great show! 🎵'
    WHEN 2 THEN 'Professional event photographer. Capturing moments that matter. 📸'
    WHEN 3 THEN 'Festival junkie from LA. Love connecting with new people at events!'
    WHEN 4 THEN 'Tech entrepreneur who loves live music and networking events.'
    WHEN 5 THEN 'Event coordinator and community builder. Let''s connect! 🤝'
    ELSE bio
  END,
  photo_url = CASE (SELECT rn FROM sample_users WHERE user_id = up.user_id)
    WHEN 1 THEN 'https://api.dicebear.com/7.x/avataaars/svg?seed=user1'
    WHEN 2 THEN 'https://api.dicebear.com/7.x/avataaars/svg?seed=user2'
    WHEN 3 THEN 'https://api.dicebear.com/7.x/avataaars/svg?seed=user3'
    WHEN 4 THEN 'https://api.dicebear.com/7.x/avataaars/svg?seed=user4'
    WHEN 5 THEN 'https://api.dicebear.com/7.x/avataaars/svg?seed=user5'
    ELSE photo_url
  END,
  location = CASE (SELECT rn FROM sample_users WHERE user_id = up.user_id)
    WHEN 1 THEN 'Los Angeles, CA'
    WHEN 2 THEN 'New York, NY'
    WHEN 3 THEN 'San Francisco, CA'
    WHEN 4 THEN 'Austin, TX'
    WHEN 5 THEN 'Seattle, WA'
    ELSE location
  END
WHERE user_id IN (SELECT user_id FROM sample_users);

-- Show updated users
SELECT 
  user_id,
  display_name,
  LEFT(COALESCE(bio, ''), 50) as bio_preview,
  CASE WHEN photo_url IS NOT NULL THEN '✓ Has photo' ELSE '✗ No photo' END as has_photo,
  location
FROM user_profiles
WHERE bio IS NOT NULL OR photo_url IS NOT NULL OR location IS NOT NULL
LIMIT 10;

-- ============================================
-- Now test the user_search view
-- ============================================

SELECT 
  '=== Testing user_search view ===' as test,
  user_id,
  display_name,
  LEFT(COALESCE(bio, '(no bio)'), 40) as bio,
  location,
  follower_count,
  following_count,
  current_user_follow_status
FROM user_search
LIMIT 5;

-- ============================================
-- Test Result Summary
-- ============================================

SELECT 
  COUNT(*) as total_profiles,
  COUNT(bio) as profiles_with_bio,
  COUNT(photo_url) as profiles_with_photo,
  COUNT(location) as profiles_with_location,
  ROUND(100.0 * COUNT(bio) / NULLIF(COUNT(*), 0), 1) as pct_with_bio
FROM user_profiles;

SELECT 'Test data populated successfully! ✓' as status;

