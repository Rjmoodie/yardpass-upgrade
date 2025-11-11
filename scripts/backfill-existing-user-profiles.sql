-- ============================================================================
-- Backfill Profiles for Existing Users
-- ============================================================================
-- Purpose: Create profiles for users who existed before trigger was added
-- Run this ONCE after migration if you have existing users
-- ============================================================================

-- Check how many users are missing profiles
SELECT 
  'Users missing profiles' as status,
  COUNT(*) as count
FROM auth.users u
LEFT JOIN users.user_profiles p ON u.id = p.user_id
WHERE p.user_id IS NULL;

-- Create profiles for all users who don't have one
INSERT INTO users.user_profiles (
  user_id,
  display_name,
  email,
  phone,
  role,
  verification_status,
  created_at,
  updated_at
)
SELECT 
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'display_name',
    SPLIT_PART(u.email, '@', 1),
    'User'
  ),
  u.email,
  u.phone,
  'attendee', -- All existing users start as attendee
  'none',     -- All start unverified
  u.created_at,
  now()
FROM auth.users u
LEFT JOIN users.user_profiles p ON u.id = p.user_id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Verify all users now have profiles
SELECT 
  'Verification' as status,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ All users have profiles'
    ELSE '⚠️ ' || COUNT(*)::text || ' users still missing profiles'
  END as result
FROM auth.users u
LEFT JOIN users.user_profiles p ON u.id = p.user_id
WHERE p.user_id IS NULL;

