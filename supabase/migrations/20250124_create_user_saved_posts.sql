-- Create user_saved_posts table in events schema
CREATE TABLE IF NOT EXISTS events.user_saved_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES events.event_posts(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, post_id)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_saved_posts_user_id ON events.user_saved_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_posts_post_id ON events.user_saved_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_posts_created_at ON events.user_saved_posts(created_at DESC);

-- Enable RLS
ALTER TABLE events.user_saved_posts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own saved posts
CREATE POLICY "Users can view own saved posts"
  ON events.user_saved_posts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own saved posts
CREATE POLICY "Users can insert own saved posts"
  ON events.user_saved_posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own saved posts
CREATE POLICY "Users can delete own saved posts"
  ON events.user_saved_posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON events.user_saved_posts TO authenticated;
GRANT SELECT ON events.user_saved_posts TO anon;

COMMENT ON TABLE events.user_saved_posts IS 'Stores user-saved/bookmarked posts';

