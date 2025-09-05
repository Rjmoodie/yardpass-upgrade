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
CREATE INDEX idx_post_views_user_session ON post_views(coalesce(user_id::text, session_id), post_id, date_trunc('day', created_at));

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

-- Create materialized view for daily KPIs
CREATE MATERIALIZED VIEW public.event_video_kpis_daily AS
WITH v AS (
  SELECT event_id,
         date_trunc('day', created_at)::date AS d,
         count(*) FILTER (WHERE qualified) AS views_total,
         count(DISTINCT CASE WHEN qualified THEN coalesce(user_id::text, session_id) END) AS views_unique,
         count(*) FILTER (WHERE completed) AS completions,
         avg(dwell_ms) FILTER (WHERE qualified) AS avg_dwell_ms
  FROM post_views
  GROUP BY 1, 2
),
c AS (
  SELECT event_id,
         date_trunc('day', created_at)::date AS d,
         count(*) FILTER (WHERE target='tickets') AS clicks_tickets,
         count(*) FILTER (WHERE target='details') AS clicks_details,
         count(*) FILTER (WHERE target='organizer') AS clicks_organizer,
         count(*) FILTER (WHERE target='share') AS clicks_share,
         count(*) FILTER (WHERE target='comment') AS clicks_comment
  FROM post_clicks
  GROUP BY 1, 2
),
e AS (
  SELECT p.event_id,
         date_trunc('day', r.created_at)::date AS d,
         count(*) FILTER (WHERE r.kind='like') AS likes,
         count(*) FILTER (WHERE r.kind='share') AS shares
  FROM event_posts p
  LEFT JOIN event_reactions r ON r.post_id = p.id
  GROUP BY 1, 2
),
m AS (
  SELECT p.event_id,
         date_trunc('day', c.created_at)::date AS d,
         count(*) AS comments
  FROM event_posts p
  LEFT JOIN event_comments c ON c.post_id = p.id
  GROUP BY 1, 2
)
SELECT
  coalesce(v.event_id, c.event_id, e.event_id, m.event_id) AS event_id,
  coalesce(v.d, c.d, e.d, m.d) AS d,
  coalesce(views_total, 0) AS views_total,
  coalesce(views_unique, 0) AS views_unique,
  coalesce(completions, 0) AS completions,
  coalesce(avg_dwell_ms, 0) AS avg_dwell_ms,
  coalesce(clicks_tickets, 0) AS clicks_tickets,
  coalesce(clicks_details, 0) AS clicks_details,
  coalesce(clicks_organizer, 0) AS clicks_organizer,
  coalesce(clicks_share, 0) AS clicks_share,
  coalesce(clicks_comment, 0) AS clicks_comment,
  coalesce(likes, 0) AS likes,
  coalesce(comments, 0) AS comments,
  coalesce(shares, 0) AS shares
FROM v FULL JOIN c USING(event_id, d)
       FULL JOIN e USING(event_id, d)  
       FULL JOIN m USING(event_id, d);

-- Create unique index for materialized view refresh
CREATE UNIQUE INDEX idx_event_video_kpis_daily_unique ON event_video_kpis_daily(event_id, d);

-- Function to refresh analytics data
CREATE OR REPLACE FUNCTION public.refresh_video_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Refresh the materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY event_video_kpis_daily;
  
  -- Update counters from the last 60 days of data
  INSERT INTO event_video_counters (
    event_id, views_total, views_unique, completions, avg_dwell_ms,
    clicks_tickets, clicks_details, clicks_organizer, clicks_share, clicks_comment,
    likes, comments, shares, updated_at
  )
  SELECT 
    event_id,
    sum(views_total) AS views_total,
    sum(views_unique) AS views_unique, -- Note: this is approximate for unique counts
    sum(completions) AS completions,
    avg(avg_dwell_ms) AS avg_dwell_ms,
    sum(clicks_tickets) AS clicks_tickets,
    sum(clicks_details) AS clicks_details,
    sum(clicks_organizer) AS clicks_organizer,
    sum(clicks_share) AS clicks_share,
    sum(clicks_comment) AS clicks_comment,
    sum(likes) AS likes,
    sum(comments) AS comments,
    sum(shares) AS shares,
    now() AS updated_at
  FROM event_video_kpis_daily 
  WHERE d >= current_date - interval '60 days'
  GROUP BY event_id
  ON CONFLICT (event_id) DO UPDATE SET
    views_total = EXCLUDED.views_total,
    views_unique = EXCLUDED.views_unique,
    completions = EXCLUDED.completions,
    avg_dwell_ms = EXCLUDED.avg_dwell_ms,
    clicks_tickets = EXCLUDED.clicks_tickets,
    clicks_details = EXCLUDED.clicks_details,
    clicks_organizer = EXCLUDED.clicks_organizer,
    clicks_share = EXCLUDED.clicks_share,
    clicks_comment = EXCLUDED.clicks_comment,
    likes = EXCLUDED.likes,
    comments = EXCLUDED.comments,
    shares = EXCLUDED.shares,
    updated_at = EXCLUDED.updated_at;
END;
$$;