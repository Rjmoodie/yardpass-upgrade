-- =====================================================================
-- AUDIENCE ANALYTICS - PHASE 1: FOUNDATION
-- Migration: 20251112000000_analytics_foundation.sql
-- =====================================================================
-- Creates the core analytics infrastructure for first-party tracking
-- Replaces PostHog with internal database for accuracy and performance
-- =====================================================================

-- =====================================================================
-- 1. CREATE ANALYTICS SCHEMA
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS analytics;

COMMENT ON SCHEMA analytics IS 'First-party event tracking and audience analytics';

-- =====================================================================
-- 2. CANONICAL EVENTS TABLE
-- =====================================================================
-- Single source of truth for all user/session events
-- Designed for append-only performance with time-series partitioning

CREATE TABLE IF NOT EXISTS analytics.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Event identification
  event_name TEXT NOT NULL,  -- page_view, ticket_cta_click, checkout_started, purchase, etc.
  
  -- Identity (nullable for anonymous)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  anon_id TEXT,  -- Client-side anonymous ID (cookie-based)
  
  -- Context
  event_id UUID,  -- References events.events(id) when applicable
  org_id UUID,    -- Organizer context
  post_id UUID,   -- References event_posts(id) when applicable
  
  -- Navigation
  url TEXT,
  referrer TEXT,
  path TEXT,
  
  -- Attribution
  utm JSONB DEFAULT '{}'::jsonb,  -- {source, medium, campaign, term, content}
  
  -- Device & Browser
  device JSONB DEFAULT '{}'::jsonb,  -- {type, os, browser, version}
  
  -- Geography (from IP, aggregated)
  geo JSONB DEFAULT '{}'::jsonb,  -- {country, region, city}
  
  -- Additional properties
  props JSONB DEFAULT '{}'::jsonb,  -- Flexible properties (button_id, position, etc.)
  
  -- Quality & filtering
  is_bot BOOLEAN DEFAULT FALSE,
  is_internal BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT events_session_required CHECK (session_id IS NOT NULL AND length(session_id) > 0)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_ts ON analytics.events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_org_ts ON analytics.events(org_id, ts DESC) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_ts ON analytics.events(event_id, ts DESC) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_ts ON analytics.events(event_name, ts DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_ts ON analytics.events(user_id, ts DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics.events(session_id, ts DESC);

-- Partial indexes for hot queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_purchase 
  ON analytics.events(org_id, ts DESC) 
  WHERE event_name = 'purchase' AND NOT is_bot AND NOT is_internal;

CREATE INDEX IF NOT EXISTS idx_analytics_events_page_view 
  ON analytics.events(event_id, ts DESC) 
  WHERE event_name = 'page_view' AND NOT is_bot AND NOT is_internal;

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_utm ON analytics.events USING GIN(utm);
CREATE INDEX IF NOT EXISTS idx_analytics_events_device ON analytics.events USING GIN(device);
CREATE INDEX IF NOT EXISTS idx_analytics_events_props ON analytics.events USING GIN(props);

COMMENT ON TABLE analytics.events IS 'Canonical event tracking table for all user/session interactions. Append-only, partitioned by time.';
COMMENT ON COLUMN analytics.events.user_id IS 'Authenticated user ID. NULL for anonymous sessions.';
COMMENT ON COLUMN analytics.events.session_id IS 'Client session identifier. Required for all events.';
COMMENT ON COLUMN analytics.events.anon_id IS 'Anonymous identifier from client cookie. Used for identity stitching.';
COMMENT ON COLUMN analytics.events.is_bot IS 'TRUE if identified as bot traffic via user agent or IP blocklist.';
COMMENT ON COLUMN analytics.events.is_internal IS 'TRUE if traffic from internal/staff accounts or IPs.';

-- Grant permissions
GRANT SELECT ON analytics.events TO authenticated;
GRANT INSERT ON analytics.events TO authenticated, anon;
GRANT ALL ON analytics.events TO service_role;

-- =====================================================================
-- 3. IDENTITY STITCHING
-- =====================================================================
-- Maps anonymous sessions to authenticated users when they log in
-- Allows attribution of pre-login activity to eventual purchasers

CREATE TABLE IF NOT EXISTS analytics.identity_map (
  anon_key TEXT PRIMARY KEY,  -- session_id or anon_id
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Promotion tracking
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  promoted_at TIMESTAMPTZ,  -- When anonymous was linked to user
  
  -- Metadata
  promotion_count INTEGER DEFAULT 1,  -- How many times this key was promoted
  
  CONSTRAINT identity_map_user_required CHECK (user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_identity_map_user ON analytics.identity_map(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_map_promoted ON analytics.identity_map(promoted_at) WHERE promoted_at IS NOT NULL;

COMMENT ON TABLE analytics.identity_map IS 'Maps anonymous sessions/anon_ids to authenticated users for identity resolution.';
COMMENT ON COLUMN analytics.identity_map.anon_key IS 'Anonymous identifier (session_id or anon_id) to resolve.';
COMMENT ON COLUMN analytics.identity_map.promoted_at IS 'When this anonymous identifier was first linked to a user.';

-- Grant permissions
GRANT SELECT ON analytics.identity_map TO authenticated;
GRANT INSERT, UPDATE ON analytics.identity_map TO authenticated, service_role;
GRANT ALL ON analytics.identity_map TO service_role;

-- =====================================================================
-- 4. CHANNEL TAXONOMY
-- =====================================================================
-- Normalizes raw UTM sources into clean channel categories
-- Makes reporting consistent across different source naming conventions

CREATE TABLE IF NOT EXISTS analytics.channel_taxonomy (
  id SERIAL PRIMARY KEY,
  raw_source TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL CHECK (channel IN (
    'direct',
    'search',
    'social',
    'email',
    'ads',
    'referral',
    'other'
  )),
  
  -- Optional subcategory
  subchannel TEXT,  -- e.g., 'google', 'facebook', 'instagram'
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_taxonomy_source ON analytics.channel_taxonomy(raw_source);
CREATE INDEX IF NOT EXISTS idx_channel_taxonomy_channel ON analytics.channel_taxonomy(channel);

COMMENT ON TABLE analytics.channel_taxonomy IS 'Maps raw UTM sources to standardized channel categories for clean reporting.';

-- Seed common mappings
INSERT INTO analytics.channel_taxonomy (raw_source, channel, subchannel) VALUES
  -- Direct
  ('direct', 'direct', NULL),
  ('(none)', 'direct', NULL),
  ('', 'direct', NULL),
  
  -- Search engines
  ('google', 'search', 'google'),
  ('bing', 'search', 'bing'),
  ('yahoo', 'search', 'yahoo'),
  ('duckduckgo', 'search', 'duckduckgo'),
  ('gclid', 'ads', 'google_ads'),
  
  -- Social media
  ('facebook', 'social', 'facebook'),
  ('instagram', 'social', 'instagram'),
  ('twitter', 'social', 'twitter'),
  ('x.com', 'social', 'twitter'),
  ('t.co', 'social', 'twitter'),
  ('linkedin', 'social', 'linkedin'),
  ('tiktok', 'social', 'tiktok'),
  ('snapchat', 'social', 'snapchat'),
  ('pinterest', 'social', 'pinterest'),
  ('reddit', 'social', 'reddit'),
  ('youtube', 'social', 'youtube'),
  
  -- Email
  ('email', 'email', NULL),
  ('newsletter', 'email', 'newsletter'),
  ('mailchimp', 'email', 'mailchimp'),
  ('sendgrid', 'email', 'sendgrid'),
  
  -- Ads
  ('facebook_ads', 'ads', 'facebook'),
  ('instagram_ads', 'ads', 'instagram'),
  ('google_ads', 'ads', 'google'),
  ('tiktok_ads', 'ads', 'tiktok'),
  ('snapchat_ads', 'ads', 'snapchat'),
  
  -- Referral
  ('referral', 'referral', NULL),
  ('partner', 'referral', 'partner')
ON CONFLICT (raw_source) DO NOTHING;

GRANT SELECT ON analytics.channel_taxonomy TO authenticated, anon;
GRANT ALL ON analytics.channel_taxonomy TO service_role;

-- =====================================================================
-- 5. BOT & INTERNAL TRAFFIC FILTERING
-- =====================================================================
-- Blocklists for maintaining data quality

-- IP blocklist (for internal traffic and known bots)
CREATE TABLE IF NOT EXISTS analytics.blocklist_ips (
  id SERIAL PRIMARY KEY,
  ip_address INET NOT NULL UNIQUE,
  reason TEXT NOT NULL,  -- 'internal', 'bot', 'spam', 'abuse'
  
  -- Metadata
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_blocklist_ips_address ON analytics.blocklist_ips(ip_address);

COMMENT ON TABLE analytics.blocklist_ips IS 'IP addresses to exclude from analytics (internal traffic, bots, etc).';

-- User agent blocklist (for bot detection)
CREATE TABLE IF NOT EXISTS analytics.blocklist_user_agents (
  id SERIAL PRIMARY KEY,
  pattern TEXT NOT NULL UNIQUE,  -- Regex pattern or exact match
  is_regex BOOLEAN DEFAULT FALSE,
  reason TEXT NOT NULL,  -- 'bot', 'crawler', 'scraper'
  
  -- Metadata
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_blocklist_user_agents_pattern ON analytics.blocklist_user_agents(pattern);

COMMENT ON TABLE analytics.blocklist_user_agents IS 'User agent patterns to identify and exclude bot traffic.';

-- Seed common bot patterns
INSERT INTO analytics.blocklist_user_agents (pattern, is_regex, reason, notes) VALUES
  ('bot', TRUE, 'bot', 'Generic bot identifier'),
  ('crawler', TRUE, 'crawler', 'Web crawler'),
  ('spider', TRUE, 'crawler', 'Web spider'),
  ('Googlebot', FALSE, 'bot', 'Google crawler'),
  ('Bingbot', FALSE, 'bot', 'Bing crawler'),
  ('facebookexternalhit', FALSE, 'bot', 'Facebook preview bot'),
  ('Twitterbot', FALSE, 'bot', 'Twitter preview bot'),
  ('LinkedInBot', FALSE, 'bot', 'LinkedIn preview bot'),
  ('Slackbot', FALSE, 'bot', 'Slack preview bot'),
  ('WhatsApp', FALSE, 'bot', 'WhatsApp preview bot'),
  ('curl', FALSE, 'bot', 'cURL requests'),
  ('wget', FALSE, 'bot', 'wget requests'),
  ('python-requests', FALSE, 'bot', 'Python requests library'),
  ('PostmanRuntime', FALSE, 'bot', 'Postman API client')
ON CONFLICT (pattern) DO NOTHING;

GRANT SELECT ON analytics.blocklist_ips TO authenticated, anon;
GRANT SELECT ON analytics.blocklist_user_agents TO authenticated, anon;
GRANT ALL ON analytics.blocklist_ips TO service_role;
GRANT ALL ON analytics.blocklist_user_agents TO service_role;

-- =====================================================================
-- 6. HELPER FUNCTIONS
-- =====================================================================

-- Function to resolve user from anonymous key
CREATE OR REPLACE FUNCTION analytics.resolve_user_id(
  p_session_id TEXT,
  p_anon_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_resolved_user_id UUID;
BEGIN
  -- If user_id provided, use it directly
  IF p_user_id IS NOT NULL THEN
    RETURN p_user_id;
  END IF;
  
  -- Try to resolve from session_id
  SELECT user_id INTO v_resolved_user_id
  FROM analytics.identity_map
  WHERE anon_key = p_session_id
  LIMIT 1;
  
  IF v_resolved_user_id IS NOT NULL THEN
    RETURN v_resolved_user_id;
  END IF;
  
  -- Try to resolve from anon_id
  IF p_anon_id IS NOT NULL THEN
    SELECT user_id INTO v_resolved_user_id
    FROM analytics.identity_map
    WHERE anon_key = p_anon_id
    LIMIT 1;
  END IF;
  
  RETURN v_resolved_user_id;
END;
$$;

COMMENT ON FUNCTION analytics.resolve_user_id IS 'Resolves anonymous session/anon_id to authenticated user_id using identity map.';

-- Function to normalize channel from UTM source
CREATE OR REPLACE FUNCTION analytics.normalize_channel(
  p_utm_source TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_channel TEXT;
BEGIN
  -- Handle null/empty
  IF p_utm_source IS NULL OR p_utm_source = '' THEN
    RETURN 'direct';
  END IF;
  
  -- Lookup in taxonomy
  SELECT channel INTO v_channel
  FROM analytics.channel_taxonomy
  WHERE raw_source = LOWER(p_utm_source)
  LIMIT 1;
  
  -- Return mapped channel or 'other'
  RETURN COALESCE(v_channel, 'other');
END;
$$;

COMMENT ON FUNCTION analytics.normalize_channel IS 'Maps raw UTM source to standardized channel category.';

-- Function to check if user agent is a bot
CREATE OR REPLACE FUNCTION analytics.is_bot_user_agent(
  p_user_agent TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_pattern RECORD;
BEGIN
  -- Handle null/empty
  IF p_user_agent IS NULL OR p_user_agent = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Check against blocklist patterns
  FOR v_pattern IN 
    SELECT pattern, is_regex 
    FROM analytics.blocklist_user_agents
  LOOP
    IF v_pattern.is_regex THEN
      -- Regex pattern match
      IF p_user_agent ~* v_pattern.pattern THEN
        RETURN TRUE;
      END IF;
    ELSE
      -- Exact substring match (case insensitive)
      IF LOWER(p_user_agent) LIKE '%' || LOWER(v_pattern.pattern) || '%' THEN
        RETURN TRUE;
      END IF;
    END IF;
  END LOOP;
  
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION analytics.is_bot_user_agent IS 'Checks if user agent matches known bot patterns.';

-- =====================================================================
-- 7. ROW LEVEL SECURITY
-- =====================================================================

-- Enable RLS on tables
ALTER TABLE analytics.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics.identity_map ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see events for their organizations
CREATE POLICY "Users can view events for their orgs"
  ON analytics.events
  FOR SELECT
  TO authenticated
  USING (
    org_id IS NULL
    OR EXISTS (
      SELECT 1 FROM organizations.org_memberships om
      WHERE om.org_id = analytics.events.org_id
        AND om.user_id = auth.uid()
    )
  );

-- Policy: Service role has full access
CREATE POLICY "Service role full access on events"
  ON analytics.events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Anonymous can insert events
CREATE POLICY "Anonymous can insert events"
  ON analytics.events
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Authenticated can insert events
CREATE POLICY "Authenticated can insert events"
  ON analytics.events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Users can view their own identity mappings
CREATE POLICY "Users can view their identity mappings"
  ON analytics.identity_map
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Service role full access on identity_map
CREATE POLICY "Service role full access on identity_map"
  ON analytics.identity_map
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================================
-- 8. AUDIT LOG
-- =====================================================================
-- Track who queries analytics and when (for governance)

CREATE TABLE IF NOT EXISTS analytics.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Who
  user_id UUID REFERENCES auth.users(id),
  org_id UUID,
  
  -- What
  function_name TEXT NOT NULL,
  args JSONB DEFAULT '{}'::jsonb,
  
  -- Performance
  duration_ms INTEGER,
  
  -- Result
  success BOOLEAN,
  error_message TEXT,
  
  -- Context
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON analytics.audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON analytics.audit_log(user_id, ts DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_org ON analytics.audit_log(org_id, ts DESC) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_function ON analytics.audit_log(function_name, ts DESC);

COMMENT ON TABLE analytics.audit_log IS 'Audit trail for analytics RPC function calls (governance and compliance).';

GRANT SELECT ON analytics.audit_log TO authenticated;
GRANT INSERT ON analytics.audit_log TO authenticated, service_role;
GRANT ALL ON analytics.audit_log TO service_role;

-- =====================================================================
-- MIGRATION COMPLETE - PHASE 1: FOUNDATION
-- =====================================================================

-- Summary:
-- ✅ analytics.events - Canonical event tracking table
-- ✅ analytics.identity_map - Session-to-user stitching
-- ✅ analytics.channel_taxonomy - UTM normalization
-- ✅ analytics.blocklist_ips - IP filtering
-- ✅ analytics.blocklist_user_agents - Bot detection
-- ✅ Helper functions for resolution and normalization
-- ✅ Row Level Security policies
-- ✅ Audit logging for compliance
--
-- Next: Phase 2 - Create get_audience_funnel_internal RPC function

