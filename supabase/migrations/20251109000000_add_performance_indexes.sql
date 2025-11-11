-- Migration: Add Performance Indexes
-- Date: 2025-11-09
-- Ticket: PERF-006
-- 
-- Adds missing composite indexes for tracking tables to support
-- efficient queries in feed ranking and analytics functions.
-- Only creates indexes for tables that definitely exist.

-- ==========================================
-- PART 1: Ticket Detail Views Indexes
-- ==========================================

-- Check if table exists before creating index
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'ticket_detail_views'
  ) THEN
    -- Composite index for user journey queries (purchase intent tracking)
    CREATE INDEX IF NOT EXISTS idx_ticket_detail_views_user_event_recent
      ON public.ticket_detail_views(user_id, event_id, viewed_at DESC)
      WHERE user_id IS NOT NULL;
    
    RAISE NOTICE '✅ Created index: idx_ticket_detail_views_user_event_recent';
  ELSE
    RAISE NOTICE '⚠️ Skipped: ticket_detail_views table does not exist';
  END IF;
END $$;

-- ==========================================
-- PART 2: Profile Visits Indexes
-- ==========================================

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'profile_visits'
  ) THEN
    -- Composite index for profile visit patterns (affinity tracking)
    CREATE INDEX IF NOT EXISTS idx_profile_visits_visitor_visited_recent
      ON public.profile_visits(visitor_id, visited_user_id, visited_at DESC)
      WHERE visitor_id IS NOT NULL;
    
    RAISE NOTICE '✅ Created index: idx_profile_visits_visitor_visited_recent';
  ELSE
    RAISE NOTICE '⚠️ Skipped: profile_visits table does not exist';
  END IF;
END $$;

-- ==========================================
-- PART 3: Event Impressions Enhanced Index
-- ==========================================

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'events' 
    AND table_name = 'event_impressions'
  ) THEN
    -- Enhanced event impressions index (covers more query patterns)
    CREATE INDEX IF NOT EXISTS idx_event_impressions_user_dwell_session
      ON events.event_impressions(user_id, event_id, session_id, created_at DESC)
      WHERE dwell_ms >= 10000 AND completed = true;
    
    RAISE NOTICE '✅ Created index: idx_event_impressions_user_dwell_session';
  ELSE
    RAISE NOTICE '⚠️ Skipped: events.event_impressions table does not exist';
  END IF;
END $$;

-- ==========================================
-- PART 4: Saved Events Index
-- ==========================================

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'saved_events'
  ) THEN
    -- Ensure index exists for saved events queries
    CREATE INDEX IF NOT EXISTS idx_saved_events_user_event_recent
      ON public.saved_events(user_id, event_id, saved_at DESC)
      WHERE user_id IS NOT NULL;
    
    RAISE NOTICE '✅ Created index: idx_saved_events_user_event_recent';
  ELSE
    RAISE NOTICE '⚠️ Skipped: saved_events table does not exist';
  END IF;
END $$;

-- ==========================================
-- PART 5: Checkout Sessions Index
-- ==========================================

DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'checkout_sessions'
  ) THEN
    -- Index for abandoned checkout queries (high purchase intent)
    CREATE INDEX IF NOT EXISTS idx_checkout_sessions_user_event_recent
      ON public.checkout_sessions(user_id, event_id, started_at DESC)
      WHERE completed_at IS NULL; -- Only abandoned checkouts
    
    RAISE NOTICE '✅ Created index: idx_checkout_sessions_user_event_recent';
  ELSE
    RAISE NOTICE '⚠️ Skipped: checkout_sessions table does not exist';
  END IF;
END $$;

-- ==========================================
-- PART 6: Analyze Tables (only if they exist)
-- ==========================================

DO $$ 
BEGIN
  -- Conditionally analyze tables
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ticket_detail_views') THEN
    EXECUTE 'ANALYZE public.ticket_detail_views';
    RAISE NOTICE '✅ Analyzed: ticket_detail_views';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profile_visits') THEN
    EXECUTE 'ANALYZE public.profile_visits';
    RAISE NOTICE '✅ Analyzed: profile_visits';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'events' AND table_name = 'event_impressions') THEN
    EXECUTE 'ANALYZE events.event_impressions';
    RAISE NOTICE '✅ Analyzed: event_impressions';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saved_events') THEN
    EXECUTE 'ANALYZE public.saved_events';
    RAISE NOTICE '✅ Analyzed: saved_events';
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'checkout_sessions') THEN
    EXECUTE 'ANALYZE public.checkout_sessions';
    RAISE NOTICE '✅ Analyzed: checkout_sessions';
  END IF;
END $$;

-- ==========================================
-- PART 7: Monitoring Query
-- ==========================================

-- List all indexes we just created (or attempted to create)
SELECT 
  i.schemaname,
  i.tablename,
  i.indexname,
  pg_size_pretty(pg_relation_size((i.schemaname || '.' || i.indexname)::regclass)) as index_size
FROM pg_indexes i
WHERE i.indexname IN (
  'idx_ticket_detail_views_user_event_recent',
  'idx_profile_visits_visitor_visited_recent',
  'idx_event_impressions_user_dwell_session',
  'idx_saved_events_user_event_recent',
  'idx_checkout_sessions_user_event_recent'
)
ORDER BY i.schemaname, i.tablename;

-- Success message
SELECT '✅ Performance indexes migration complete! Check NOTICE messages above for details.' AS status;


