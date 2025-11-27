-- Create tables for video error and metric tracking
-- Part of video analytics observability feature

-- Ensure analytics schema exists
CREATE SCHEMA IF NOT EXISTS analytics;

-- Video errors table for tracking playback failures
CREATE TABLE IF NOT EXISTS analytics.video_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  error_type TEXT NOT NULL,
  playback_id TEXT,
  url TEXT,
  error_message TEXT NOT NULL,
  post_id UUID,
  event_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  -- Context fields (stored as JSONB for flexibility)
  -- user_agent, network_type, ready_state, network_state, hls_error_type, hls_error_details
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Video metrics table for tracking performance metrics
CREATE TABLE IF NOT EXISTS analytics.video_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric TEXT NOT NULL, -- time_to_first_frame, time_to_play, buffering_duration, playback_start_failed
  playback_id TEXT,
  url TEXT,
  value INTEGER NOT NULL, -- Value in milliseconds
  post_id UUID,
  event_id UUID,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  context JSONB DEFAULT '{}'::jsonb,
  -- Context fields (stored as JSONB)
  -- user_agent, network_type
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_video_errors_post_id ON analytics.video_errors(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_errors_event_id ON analytics.video_errors(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_errors_error_type ON analytics.video_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_video_errors_created_at ON analytics.video_errors(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_video_metrics_post_id ON analytics.video_metrics(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_metrics_event_id ON analytics.video_metrics(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_video_metrics_metric ON analytics.video_metrics(metric);
CREATE INDEX IF NOT EXISTS idx_video_metrics_created_at ON analytics.video_metrics(created_at DESC);

-- Enable RLS (write via service role only, read access optional)
ALTER TABLE analytics.video_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.video_metrics ENABLE ROW LEVEL SECURITY;

-- Note: Service role bypasses RLS entirely, so these policies are documentation
-- Edge Functions using service key will always be able to insert regardless

-- Policy: Service role can insert (for Edge Functions) - documentation only
CREATE POLICY "Service role can insert video errors"
  ON analytics.video_errors
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can insert video metrics"
  ON analytics.video_metrics
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Policy: Authenticated users can read their own data (optional - comment out if not needed)
-- If you don't want user-facing access, remove these policies and revoke access:
-- REVOKE ALL ON analytics.video_errors FROM authenticated;
-- REVOKE ALL ON analytics.video_metrics FROM authenticated;
CREATE POLICY "Users can read own video errors"
  ON analytics.video_errors
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read own video metrics"
  ON analytics.video_metrics
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Note: Rows with user_id IS NULL are invisible to authenticated users (by design)

-- Add comments
COMMENT ON TABLE analytics.video_errors IS 'Tracks video playback errors for debugging and monitoring';
COMMENT ON TABLE analytics.video_metrics IS 'Tracks video performance metrics (load times, play times, etc.)';
COMMENT ON COLUMN analytics.video_errors.error_type IS 'Type of error: load_error, playback_error, hls_fatal_error, hls_network_error, hls_media_error, hls_init_error, autoplay_blocked, timeout, unknown';
COMMENT ON COLUMN analytics.video_metrics.metric IS 'Metric name: time_to_first_frame, time_to_play, buffering_duration, playback_start_failed';

-- Future optimizations (add when tables grow large):
-- Composite indexes for common query patterns:
-- CREATE INDEX IF NOT EXISTS idx_video_errors_type_created ON analytics.video_errors(error_type, created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_video_metrics_metric_created ON analytics.video_metrics(metric, created_at DESC);
--
-- GIN index for JSONB context queries (if filtering on context fields):
-- CREATE INDEX IF NOT EXISTS idx_video_errors_context_gin ON analytics.video_errors USING GIN (context);
-- CREATE INDEX IF NOT EXISTS idx_video_metrics_context_gin ON analytics.video_metrics USING GIN (context);
--
-- Optional: Convert to ENUM types for stricter validation:
-- CREATE TYPE analytics.video_error_type AS ENUM ('load_error', 'playback_error', 'hls_fatal_error', 'hls_network_error', 'hls_media_error', 'hls_init_error', 'autoplay_blocked', 'timeout', 'unknown');
-- CREATE TYPE analytics.video_metric_type AS ENUM ('time_to_first_frame', 'time_to_play', 'buffering_duration', 'playback_start_failed');
-- Then change columns: error_type analytics.video_error_type, metric analytics.video_metric_type

-- Data Retention:
-- These tables store potentially identifying data (user_id, ip_address, user_agent).
-- Recommended: Implement retention policy to purge data older than 90 days.
-- Example: Create a cron job or Edge Function to DELETE FROM analytics.video_errors WHERE created_at < now() - interval '90 days';
-- Consider anonymizing IP addresses (zero out last octet) if full IP isn't strictly needed for debugging.

