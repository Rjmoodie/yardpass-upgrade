-- Create tables for organic content impression tracking
-- These are separate from ad impressions (campaigns.ad_impressions)

-- Event impressions (tracks views of event cards)
CREATE TABLE IF NOT EXISTS events.event_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  dwell_ms INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hour_bucket TIMESTAMPTZ NOT NULL -- Populated by trigger for deduplication
);

-- Post impressions (tracks views of social posts)
CREATE TABLE IF NOT EXISTS events.post_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES events.event_posts(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  dwell_ms INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  hour_bucket TIMESTAMPTZ NOT NULL -- Populated by trigger for deduplication
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_impressions_event_id 
  ON events.event_impressions(event_id);
CREATE INDEX IF NOT EXISTS idx_event_impressions_created_at 
  ON events.event_impressions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_impressions_post_id 
  ON events.post_impressions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_impressions_event_id 
  ON events.post_impressions(event_id);
CREATE INDEX IF NOT EXISTS idx_post_impressions_created_at 
  ON events.post_impressions(created_at DESC);

-- Trigger functions to populate hour_bucket for deduplication
CREATE OR REPLACE FUNCTION events.set_event_impression_hour_bucket()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hour_bucket := date_trunc('hour', NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION events.set_post_impression_hour_bucket()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hour_bucket := date_trunc('hour', NEW.created_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to auto-populate hour_bucket
DROP TRIGGER IF EXISTS trg_set_event_impression_hour_bucket ON events.event_impressions;
CREATE TRIGGER trg_set_event_impression_hour_bucket
  BEFORE INSERT OR UPDATE ON events.event_impressions
  FOR EACH ROW
  EXECUTE FUNCTION events.set_event_impression_hour_bucket();

DROP TRIGGER IF EXISTS trg_set_post_impression_hour_bucket ON events.post_impressions;
CREATE TRIGGER trg_set_post_impression_hour_bucket
  BEFORE INSERT OR UPDATE ON events.post_impressions
  FOR EACH ROW
  EXECUTE FUNCTION events.set_post_impression_hour_bucket();

-- Unique indexes to prevent duplicate impressions within the same hour
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_impressions_dedup
  ON events.event_impressions(event_id, session_id, hour_bucket);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_impressions_dedup
  ON events.post_impressions(post_id, session_id, hour_bucket);

-- Enable RLS
ALTER TABLE events.event_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events.post_impressions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert impressions (for anonymous tracking)
DROP POLICY IF EXISTS "Anyone can insert event impressions" ON events.event_impressions;
CREATE POLICY "Anyone can insert event impressions"
  ON events.event_impressions
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can insert post impressions" ON events.post_impressions;
CREATE POLICY "Anyone can insert post impressions"
  ON events.post_impressions
  FOR INSERT
  WITH CHECK (true);

-- Only users can read their own impressions
DROP POLICY IF EXISTS "Users can read their own event impressions" ON events.event_impressions;
CREATE POLICY "Users can read their own event impressions"
  ON events.event_impressions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read their own post impressions" ON events.post_impressions;
CREATE POLICY "Users can read their own post impressions"
  ON events.post_impressions
  FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE events.event_impressions IS 
  'Tracks user views of event cards (organic content, not ads)';
COMMENT ON TABLE events.post_impressions IS 
  'Tracks user views of social posts (organic content, not ads)';

