-- Add attendee following support to YardPass
-- This migration depends on 20250301000011_add_user_to_follow_target.sql
-- The 'user' enum value must already exist before running this migration

-- First, add necessary columns to user_profiles for social features
DO $$ 
BEGIN
    -- Add bio column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'bio') THEN
        ALTER TABLE public.user_profiles ADD COLUMN bio TEXT;
    END IF;
    
    -- Add photo_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'photo_url') THEN
        ALTER TABLE public.user_profiles ADD COLUMN photo_url TEXT;
    END IF;
    
    -- Add location column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'location') THEN
        ALTER TABLE public.user_profiles ADD COLUMN location TEXT;
    END IF;
END $$;

-- Add the status column to follows table (for follow request approval)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'follows' AND column_name = 'status') THEN
        ALTER TABLE public.follows ADD COLUMN status TEXT DEFAULT 'accepted' 
        CHECK (status IN ('pending', 'accepted', 'declined'));
    END IF;
END $$;

-- Add user profile components to follow lists
-- Create a view that includes user profile data for follow lists
CREATE OR REPLACE VIEW public.follow_profiles AS
SELECT 
  f.id,
  f.follower_user_id,
  f.target_type,
  f.target_id,
  COALESCE(f.status, 'accepted') as status,
  f.created_at,
  -- User profile data for user targets
  CASE 
    WHEN f.target_type = 'user' THEN up.display_name
    WHEN f.target_type = 'organizer' THEN o.name
    WHEN f.target_type = 'event' THEN e.title
    ELSE NULL
  END AS target_name,
  CASE 
    WHEN f.target_type = 'user' THEN up.photo_url
    WHEN f.target_type = 'organizer' THEN o.logo_url
    WHEN f.target_type = 'event' THEN e.cover_image_url
    ELSE NULL
  END AS target_photo,
  -- Follower profile data (always a user in current schema)
  up_follower.display_name AS follower_name,
  up_follower.photo_url AS follower_photo
FROM public.follows f
LEFT JOIN public.user_profiles up ON f.target_type = 'user' AND up.user_id = f.target_id
LEFT JOIN public.organizations o ON f.target_type = 'organizer' AND o.id = f.target_id
LEFT JOIN public.events e ON f.target_type = 'event' AND e.id = f.target_id
LEFT JOIN public.user_profiles up_follower ON up_follower.user_id = f.follower_user_id;

-- Create user search view for finding users to follow
CREATE OR REPLACE VIEW public.user_search AS
SELECT 
  up.user_id,
  up.display_name,
  up.photo_url,
  up.bio,
  up.location,
  up.created_at,
  -- Follow stats
  COALESCE(followers.count, 0) AS follower_count,
  COALESCE(following.count, 0) AS following_count,
  -- Check if current user is following this user
  CASE 
    WHEN current_user_follow.id IS NOT NULL THEN COALESCE(current_user_follow.status, 'accepted')
    ELSE 'none'
  END AS current_user_follow_status
FROM public.user_profiles up
LEFT JOIN (
  SELECT 
    target_id,
    COUNT(*) as count
  FROM public.follows 
  WHERE target_type = 'user' AND COALESCE(status, 'accepted') = 'accepted'
  GROUP BY target_id
) followers ON followers.target_id = up.user_id
LEFT JOIN (
  SELECT 
    follower_user_id,
    COUNT(*) as count
  FROM public.follows 
  WHERE target_type = 'user' AND COALESCE(status, 'accepted') = 'accepted'
  GROUP BY follower_user_id
) following ON following.follower_user_id = up.user_id
LEFT JOIN LATERAL (
  SELECT 
    id,
    status
  FROM public.follows 
  WHERE target_type = 'user' 
    AND follower_user_id = auth.uid()
    AND target_id = up.user_id
  LIMIT 1
) current_user_follow ON true;

-- Add RLS policies for user following (with conflict handling)
DO $$ 
BEGIN
  -- Drop existing policies if they exist to avoid conflicts
  DROP POLICY IF EXISTS "users_can_follow_other_users" ON public.follows;
  DROP POLICY IF EXISTS "users_can_manage_their_follows" ON public.follows;
  DROP POLICY IF EXISTS "users_can_see_follow_requests" ON public.follows;
  
  -- Create the policies
  CREATE POLICY "users_can_follow_other_users" ON public.follows
  FOR INSERT WITH CHECK (
    target_type = 'user' 
    AND follower_user_id = auth.uid()
    AND target_id != auth.uid() -- Can't follow yourself
  );

  CREATE POLICY "users_can_manage_their_follows" ON public.follows
  FOR UPDATE USING (
    follower_user_id = auth.uid()
  ) WITH CHECK (
    status IN ('pending', 'accepted', 'declined')
  );

  CREATE POLICY "users_can_see_follow_requests" ON public.follows
  FOR SELECT USING (
    -- Can see follows where you're the follower
    follower_user_id = auth.uid()
    OR 
    -- Can see follows where you're the target (for follow requests)
    (target_type = 'user' AND target_id = auth.uid())
  );
END $$;

-- Create function to get user's social connections
CREATE OR REPLACE FUNCTION public.get_user_connections(user_id UUID)
RETURNS TABLE (
  connection_type TEXT,
  connection_id UUID,
  connection_name TEXT,
  connection_photo TEXT,
  connection_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  -- People this user follows
  SELECT 
    'following'::TEXT,
    fp.target_id::UUID,
    fp.target_name::TEXT,
    fp.target_photo::TEXT,
    1::INTEGER
  FROM public.follow_profiles fp
  WHERE fp.follower_user_id = $1 
    AND fp.target_type = 'user'
    AND fp.status = 'accepted'
  
  UNION ALL
  
  -- People who follow this user
  SELECT 
    'followers'::TEXT,
    fp.follower_user_id::UUID,
    fp.follower_name::TEXT,
    fp.follower_photo::TEXT,
    1::INTEGER
  FROM public.follow_profiles fp
  WHERE fp.target_id = $1 
    AND fp.target_type = 'user'
    AND fp.status = 'accepted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get mutual connections
CREATE OR REPLACE FUNCTION public.get_mutual_connections(user1_id UUID, user2_id UUID)
RETURNS TABLE (
  mutual_user_id UUID,
  mutual_user_name TEXT,
  mutual_user_photo TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f1.target_id,
    up.display_name,
    up.photo_url
  FROM public.follows f1
  JOIN public.follows f2 ON f1.target_id = f2.target_id
  JOIN public.user_profiles up ON up.user_id = f1.target_id
  WHERE f1.follower_user_id = $1
    AND f2.follower_user_id = $2
    AND f1.target_type = 'user'
    AND f2.target_type = 'user'
    AND f1.status = 'accepted'
    AND f2.status = 'accepted';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_follows_user_target ON public.follows(target_type, target_id) 
  WHERE target_type = 'user';

CREATE INDEX IF NOT EXISTS idx_follows_user_follower ON public.follows(follower_user_id, target_type) 
  WHERE target_type = 'user';

CREATE INDEX IF NOT EXISTS idx_follows_user_status ON public.follows(status, target_type) 
  WHERE target_type = 'user';

-- Add notification triggers for user follows
CREATE OR REPLACE FUNCTION public.notify_user_follow()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify for user-to-user follows
  IF NEW.target_type = 'user' AND NEW.target_id != NEW.follower_user_id THEN
    -- Insert notification for the user being followed
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      data
    ) VALUES (
      NEW.target_id,
      'follow_request',
      'New Follow Request',
      CASE 
        WHEN NEW.status = 'pending' THEN 'Someone wants to follow you'
        WHEN NEW.status = 'accepted' THEN 'Someone started following you'
        ELSE 'Follow status updated'
      END,
      jsonb_build_object(
        'follower_user_id', NEW.follower_user_id,
        'follow_id', NEW.id,
        'status', NEW.status
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for follow notifications
DROP TRIGGER IF EXISTS trg_notify_user_follow ON public.follows;
CREATE TRIGGER trg_notify_user_follow
  AFTER INSERT OR UPDATE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_user_follow();

