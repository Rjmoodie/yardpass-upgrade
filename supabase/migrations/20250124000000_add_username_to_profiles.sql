-- Add username column to the base table in users schema
ALTER TABLE users.user_profiles 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Create unique constraint (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username_lower 
ON users.user_profiles (LOWER(username));

-- Create regular index for lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_username 
ON users.user_profiles (username);

-- Add check constraint for valid usernames (alphanumeric, underscore, hyphen, 3-30 chars)
ALTER TABLE users.user_profiles 
ADD CONSTRAINT username_format 
CHECK (username ~ '^[a-zA-Z0-9_-]{3,30}$' OR username IS NULL);

-- Add comment
COMMENT ON COLUMN users.user_profiles.username IS 'Unique username for user profile URLs (e.g., @username)';

-- Drop the existing view first
DROP VIEW IF EXISTS public.user_profiles CASCADE;

-- Recreate the view with the new username column
CREATE VIEW public.user_profiles AS
SELECT 
  user_id,
  display_name,
  username,
  phone,
  photo_url,
  role,
  verification_status,
  created_at,
  updated_at,
  social_links,
  sponsor_mode_enabled,
  bio,
  location
FROM users.user_profiles;

-- Grant permissions on the view
GRANT SELECT ON public.user_profiles TO authenticated, anon;
GRANT INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;

-- Update RLS policies to allow users to update their own username
-- (assuming existing policies allow users to update their own profile)

