-- Create user_saved_posts table for users to save/bookmark posts
-- This table lives in events schema alongside event_posts

CREATE TABLE IF NOT EXISTS events.user_saved_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES events.event_posts(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_saved_posts_unique UNIQUE (user_id, post_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_user_saved_posts_user_id 
  ON events.user_saved_posts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_saved_posts_post_id 
  ON events.user_saved_posts(post_id);

CREATE INDEX IF NOT EXISTS idx_user_saved_posts_event_id 
  ON events.user_saved_posts(event_id);

-- Add RLS policies
ALTER TABLE events.user_saved_posts ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved posts
CREATE POLICY "Users can view their own saved posts"
  ON events.user_saved_posts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own saved posts
CREATE POLICY "Users can insert their own saved posts"
  ON events.user_saved_posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own saved posts
CREATE POLICY "Users can delete their own saved posts"
  ON events.user_saved_posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON events.user_saved_posts TO authenticated;
GRANT USAGE ON SEQUENCE events.user_saved_posts_id_seq TO authenticated;

-- Add helpful comment
COMMENT ON TABLE events.user_saved_posts IS 'Stores posts that users have saved/bookmarked for later viewing';

