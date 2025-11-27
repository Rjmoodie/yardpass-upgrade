-- ============================================================================
-- ENABLE RLS ON ANALYTICS SYSTEM TABLES
-- ============================================================================
-- System tables should be service-role only (backend/internal use)
-- ============================================================================

-- ============================================================================
-- PART 1: System Tables - Service Role Only
-- ============================================================================

-- audit_log - Audit trail (service-role only)
ALTER TABLE analytics.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_service_role_only"
  ON analytics.audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- query_cache - Query cache (service-role only)
ALTER TABLE analytics.query_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "query_cache_service_role_only"
  ON analytics.query_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- blocklist_ips - IP blocklist (service-role only)
ALTER TABLE analytics.blocklist_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocklist_ips_service_role_only"
  ON analytics.blocklist_ips
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- blocklist_user_agents - User agent blocklist (service-role only)
ALTER TABLE analytics.blocklist_user_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocklist_user_agents_service_role_only"
  ON analytics.blocklist_user_agents
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- post_video_counters - Video analytics counters (service-role only)
ALTER TABLE analytics.post_video_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "post_video_counters_service_role_only"
  ON analytics.post_video_counters
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ai_recommendation_events - AI recommendation logs (service-role only)
ALTER TABLE analytics.ai_recommendation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_recommendation_events_service_role_only"
  ON analytics.ai_recommendation_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PART 2: Reference Tables - Public Read, Service Role Write
-- ============================================================================

-- channel_taxonomy - Channel taxonomy (public read, service-role write)
ALTER TABLE analytics.channel_taxonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_taxonomy_public_read"
  ON analytics.channel_taxonomy
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "channel_taxonomy_service_role_write"
  ON analytics.channel_taxonomy
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- industry_benchmarks - Industry benchmarks (public read, service-role write)
ALTER TABLE analytics.industry_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "industry_benchmarks_public_read"
  ON analytics.industry_benchmarks
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "industry_benchmarks_service_role_write"
  ON analytics.industry_benchmarks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS Disabled'
    END as status
FROM pg_tables
WHERE schemaname = 'analytics'
    AND tablename IN (
        'audit_log',
        'query_cache',
        'blocklist_ips',
        'blocklist_user_agents',
        'post_video_counters',
        'ai_recommendation_events',
        'channel_taxonomy',
        'industry_benchmarks'
    )
ORDER BY tablename;


