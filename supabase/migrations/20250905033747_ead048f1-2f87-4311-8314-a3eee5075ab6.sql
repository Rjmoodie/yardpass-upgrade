-- Create post_views table for tracking video/post impressions
CREATE TABLE public.post_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL,
  event_id uuid NOT NULL,
  user_id uuid,
  session_id text,
  source text, -- 'feed', 'home', 'search', 'profile'
  qualified boolean DEFAULT false, -- ≥2s & ≥25% watched
  completed boolean DEFAULT false, -- ≥90% watched
  dwell_ms integer DEFAULT 0, -- time spent viewing
  watch_percentage integer DEFAULT 0, -- percentage watched for videos
  created_at timestamptz DEFAULT now(),
  user_agent text,
  ip_address inet
);

-- Create post_clicks table for tracking CTA clicks
CREATE TABLE public.post_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL,
  event_id uuid NOT NULL,
  user_id uuid,
  session_id text,
  target text NOT NULL, -- 'tickets', 'details', 'organizer', 'share', 'comment'
  source text, -- 'feed', 'home', 'search', 'profile'
  created_at timestamptz DEFAULT now(),
  user_agent text,
  ip_address inet
);

-- Create event_video_counters for real-time aggregated counters
CREATE TABLE public.event_video_counters (
  event_id uuid PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  views_total bigint DEFAULT 0,
  views_unique bigint DEFAULT 0,
  completions bigint DEFAULT 0,
  avg_dwell_ms bigint DEFAULT 0,
  clicks_tickets bigint DEFAULT 0,
  clicks_details bigint DEFAULT 0,
  clicks_organizer bigint DEFAULT 0,
  clicks_share bigint DEFAULT 0,
  clicks_comment bigint DEFAULT 0,
  likes bigint DEFAULT 0,
  comments bigint DEFAULT 0,
  shares bigint DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_post_views_post_id ON post_views(post_id);
CREATE INDEX idx_post_views_event_id ON post_views(event_id);
CREATE INDEX idx_post_views_created_at ON post_views(created_at);
-- Create separate index without function for user/session deduplication
CREATE INDEX idx_post_views_user_id ON post_views(user_id, post_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX idx_post_views_session_id ON post_views(session_id, post_id, created_at) WHERE session_id IS NOT NULL;

CREATE INDEX idx_post_clicks_post_id ON post_clicks(post_id);
CREATE INDEX idx_post_clicks_event_id ON post_clicks(event_id);
CREATE INDEX idx_post_clicks_created_at ON post_clicks(created_at);
CREATE INDEX idx_post_clicks_target ON post_clicks(target);

-- Enable RLS
ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_video_counters ENABLE ROW LEVEL SECURITY;

-- RLS Policies for post_views
CREATE POLICY "post_views_insert_any" ON post_views
  FOR INSERT WITH CHECK (true); -- Allow anyone to log views

CREATE POLICY "post_views_select_manager" ON post_views
  FOR SELECT USING (is_event_manager(event_id));

-- RLS Policies for post_clicks  
CREATE POLICY "post_clicks_insert_any" ON post_clicks
  FOR INSERT WITH CHECK (true); -- Allow anyone to log clicks

CREATE POLICY "post_clicks_select_manager" ON post_clicks
  FOR SELECT USING (is_event_manager(event_id));

-- RLS Policies for event_video_counters
CREATE POLICY "counters_select_manager" ON event_video_counters
  FOR SELECT USING (is_event_manager(event_id));

CREATE POLICY "counters_update_system" ON event_video_counters
  FOR ALL USING (true) WITH CHECK (true); -- Allow system updates