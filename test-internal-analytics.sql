-- =====================================================================
-- INTERNAL ANALYTICS TESTING SCRIPT
-- =====================================================================
-- Comprehensive tests for the new analytics system
-- Run these queries to verify everything works
-- =====================================================================

\echo '🧪 TESTING INTERNAL ANALYTICS SYSTEM'
\echo '===================================='
\echo ''

-- =====================================================================
-- TEST 1: Schema & Tables
-- =====================================================================

\echo '1️⃣ Testing schema and tables...'

-- Check analytics schema exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'analytics')
    THEN '✅ Analytics schema exists'
    ELSE '❌ Analytics schema missing'
  END AS result;

-- Check all required tables
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('events', 'identity_map', 'channel_taxonomy', 'blocklist_ips', 'blocklist_user_agents', 'audit_log', 'query_cache')
    THEN '✅'
    ELSE '⚠️'
  END AS status
FROM information_schema.tables
WHERE table_schema = 'analytics'
ORDER BY table_name;

\echo ''

-- =====================================================================
-- TEST 2: Helper Functions
-- =====================================================================

\echo '2️⃣ Testing helper functions...'

-- Test channel normalization
SELECT 
  analytics.normalize_channel('google') AS google,
  analytics.normalize_channel('facebook') AS facebook,
  analytics.normalize_channel('direct') AS direct,
  analytics.normalize_channel('unknown_source') AS other;

-- Test bot detection
SELECT 
  analytics.is_bot_user_agent('Mozilla/5.0 (compatible; Googlebot/2.1)') AS googlebot,
  analytics.is_bot_user_agent('curl/7.68.0') AS curl,
  analytics.is_bot_user_agent('Mozilla/5.0 (Windows NT 10.0) Chrome/91.0') AS normal_browser;

\echo ''

-- =====================================================================
-- TEST 3: Insert Test Events
-- =====================================================================

\echo '3️⃣ Inserting test events...'

DO $$
DECLARE
  v_test_session TEXT := 'test_session_' || gen_random_uuid()::TEXT;
  v_test_user UUID;
  v_test_event_id UUID;
BEGIN
  -- Get a test user (or create one)
  SELECT id INTO v_test_user FROM auth.users LIMIT 1;
  
  -- Get a test event (or use NULL)
  SELECT id INTO v_test_event_id FROM events.events LIMIT 1;
  
  -- Insert awareness event
  INSERT INTO analytics.events (event_name, session_id, event_id, url, device)
  VALUES (
    'page_view',
    v_test_session,
    v_test_event_id,
    'https://liventix.com/events/test',
    '{"type":"desktop","os":"macos","browser":"chrome"}'::jsonb
  );
  
  -- Insert engagement event
  INSERT INTO analytics.events (event_name, session_id, event_id)
  VALUES ('event_view', v_test_session, v_test_event_id);
  
  -- Insert intent event
  INSERT INTO analytics.events (event_name, session_id, event_id)
  VALUES ('ticket_cta_click', v_test_session, v_test_event_id);
  
  -- Insert checkout event (if user exists)
  IF v_test_user IS NOT NULL THEN
    INSERT INTO analytics.events (event_name, session_id, user_id, event_id)
    VALUES ('checkout_started', v_test_session, v_test_user, v_test_event_id);
  END IF;
  
  RAISE NOTICE '✅ Test events inserted for session: %', v_test_session;
END $$;

\echo ''

-- =====================================================================
-- TEST 4: Main RPC Function
-- =====================================================================

\echo '4️⃣ Testing main RPC function...'

-- Get first org ID for testing
DO $$
DECLARE
  v_org_id UUID;
  v_result JSONB;
BEGIN
  SELECT id INTO v_org_id FROM organizations.organizations LIMIT 1;
  
  IF v_org_id IS NOT NULL THEN
    -- Call the funnel RPC
    SELECT public.get_audience_funnel_internal(
      v_org_id,
      NOW() - INTERVAL '30 days',
      NOW(),
      NULL,
      'none',
      'last_touch',
      TRUE
    ) INTO v_result;
    
    RAISE NOTICE '✅ Funnel RPC executed successfully';
    RAISE NOTICE 'Result keys: %', (SELECT array_agg(key) FROM jsonb_object_keys(v_result) AS key);
  ELSE
    RAISE NOTICE '⚠️ No organizations found for testing';
  END IF;
END $$;

\echo ''

-- =====================================================================
-- TEST 5: Cached Version
-- =====================================================================

\echo '5️⃣ Testing cached RPC function...'

DO $$
DECLARE
  v_org_id UUID;
  v_result JSONB;
  v_start TIMESTAMPTZ;
  v_duration_ms INTEGER;
BEGIN
  SELECT id INTO v_org_id FROM organizations.organizations LIMIT 1;
  
  IF v_org_id IS NOT NULL THEN
    v_start := clock_timestamp();
    
    -- Call cached version
    SELECT public.get_audience_funnel_cached(
      v_org_id,
      NOW() - INTERVAL '30 days',
      NOW(),
      NULL,
      TRUE
    ) INTO v_result;
    
    v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start));
    
    RAISE NOTICE '✅ Cached funnel RPC executed in % ms', v_duration_ms;
    
    IF v_duration_ms < 200 THEN
      RAISE NOTICE '✅ Performance target met (< 200ms)';
    ELSE
      RAISE NOTICE '⚠️ Performance slower than target (% ms > 200ms)', v_duration_ms;
    END IF;
  END IF;
END $$;

\echo ''

-- =====================================================================
-- TEST 6: Advanced Features
-- =====================================================================

\echo '6️⃣ Testing advanced features...'

-- Test leaky steps
DO $$
DECLARE
  v_org_id UUID;
  v_result JSONB;
BEGIN
  SELECT id INTO v_org_id FROM organizations.organizations LIMIT 1;
  
  IF v_org_id IS NOT NULL THEN
    SELECT public.get_leaky_steps_analysis(
      v_org_id,
      NOW() - INTERVAL '30 days',
      NOW()
    ) INTO v_result;
    
    RAISE NOTICE '✅ Leaky steps analysis executed';
  END IF;
END $$;

-- Test creative diagnostics
DO $$
DECLARE
  v_org_id UUID;
  v_result JSONB;
BEGIN
  SELECT id INTO v_org_id FROM organizations.organizations LIMIT 1;
  
  IF v_org_id IS NOT NULL THEN
    SELECT public.get_creative_diagnostics(
      v_org_id,
      NOW() - INTERVAL '30 days',
      NOW()
    ) INTO v_result;
    
    RAISE NOTICE '✅ Creative diagnostics executed';
  END IF;
END $$;

\echo ''

-- =====================================================================
-- TEST 7: Audit Logging
-- =====================================================================

\echo '7️⃣ Testing audit logging...'

SELECT 
  function_name,
  COUNT(*) AS calls,
  COUNT(*) FILTER (WHERE success = TRUE) AS successful,
  COUNT(*) FILTER (WHERE success = FALSE) AS failed,
  ROUND(AVG(duration_ms), 1) AS avg_duration_ms
FROM analytics.audit_log
WHERE ts >= NOW() - INTERVAL '5 minutes'
GROUP BY function_name;

\echo ''

-- =====================================================================
-- TEST 8: Data Quality
-- =====================================================================

\echo '8️⃣ Testing data quality...'

-- Bot filtering rate
SELECT 
  COUNT(*) FILTER (WHERE is_bot = TRUE) AS bot_events,
  COUNT(*) FILTER (WHERE is_bot = FALSE) AS clean_events,
  ROUND(
    COUNT(*) FILTER (WHERE is_bot = TRUE)::NUMERIC / 
    NULLIF(COUNT(*), 0) * 100, 
    1
  ) AS bot_percentage
FROM analytics.events
WHERE ts >= NOW() - INTERVAL '7 days';

-- Channel distribution
SELECT 
  analytics.normalize_channel(COALESCE(utm->>'source', 'direct')) AS channel,
  COUNT(*) AS events
FROM analytics.events
WHERE event_name = 'page_view'
  AND ts >= NOW() - INTERVAL '7 days'
  AND NOT is_bot
GROUP BY channel
ORDER BY events DESC
LIMIT 10;

\echo ''

-- =====================================================================
-- TEST 9: Performance Benchmarks
-- =====================================================================

\echo '9️⃣ Performance benchmarks...'

-- Benchmark: Direct funnel query
\timing on

DO $$
DECLARE
  v_org_id UUID;
  v_result JSONB;
BEGIN
  SELECT id INTO v_org_id FROM organizations.organizations LIMIT 1;
  
  IF v_org_id IS NOT NULL THEN
    SELECT public.get_audience_funnel_internal(
      v_org_id,
      NOW() - INTERVAL '30 days',
      NOW(),
      NULL, 'none', 'last_touch', TRUE
    ) INTO v_result;
  END IF;
END $$;

\timing off

\echo ''

-- =====================================================================
-- SUMMARY
-- =====================================================================

\echo '✅ TESTING COMPLETE'
\echo '=================='
\echo ''
\echo 'Review results above for any ❌ or ⚠️ indicators'
\echo 'All ✅ means system is ready for production!'
\echo ''

