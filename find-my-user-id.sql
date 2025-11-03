-- Run this in Supabase SQL Editor to find your user ID

-- Option 1: If you know your email
SELECT id, email, raw_user_meta_data->>'display_name' as name
FROM auth.users
WHERE email = 'your-email@example.com';  -- ← Replace with your actual email

-- Option 2: Get all recent users (find yourself)
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'display_name' as display_name,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 20;

-- Option 3: Get users with organizer role
SELECT 
  u.id,
  u.email,
  up.display_name,
  up.role
FROM auth.users u
LEFT JOIN users.user_profiles up ON up.user_id = u.id
WHERE up.role = 'organizer'
ORDER BY u.created_at DESC;

-- After finding your ID, use it in the INSERT statement below:
-- created_by = '<your_id_here>'
-- owner_context_id = '<your_id_here>'

