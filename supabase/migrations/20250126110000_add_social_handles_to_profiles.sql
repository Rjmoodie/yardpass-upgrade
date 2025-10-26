-- Add social media handle columns to user_profiles table
ALTER TABLE users.user_profiles 
ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
ADD COLUMN IF NOT EXISTS twitter_handle TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;

-- Add comments
COMMENT ON COLUMN users.user_profiles.instagram_handle IS 'Instagram username (without @)';
COMMENT ON COLUMN users.user_profiles.twitter_handle IS 'Twitter/X username (without @)';
COMMENT ON COLUMN users.user_profiles.website IS 'User website URL';
COMMENT ON COLUMN users.user_profiles.cover_photo_url IS 'Profile cover/banner image URL';

-- Drop the existing public view
DROP VIEW IF EXISTS public.user_profiles CASCADE;

-- Recreate the view with the new columns
CREATE VIEW public.user_profiles AS
SELECT 
  user_id,
  display_name,
  username,
  phone,
  photo_url,
  cover_photo_url,
  role,
  verification_status,
  created_at,
  updated_at,
  social_links,
  sponsor_mode_enabled,
  bio,
  location,
  website,
  instagram_handle,
  twitter_handle
FROM users.user_profiles;

-- Grant permissions on the view
GRANT SELECT ON public.user_profiles TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;

-- Add helpful comment
COMMENT ON VIEW public.user_profiles IS 'Public view of user profiles with social media handles';

