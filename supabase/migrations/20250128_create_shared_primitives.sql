-- Migration: Create Shared Resilience Primitives
-- Created: 2025-01-28
-- Purpose: Database support for shared rate limiter and queue utilities

-- ============================================================================
-- RATE LIMIT COUNTER TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  key TEXT PRIMARY KEY,
  count INT DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for cleanup queries (no WHERE clause - now() is not IMMUTABLE)
CREATE INDEX IF NOT EXISTS idx_rate_limit_window_end 
ON public.rate_limit_counters(window_end);

COMMENT ON TABLE public.rate_limit_counters IS 'Rate limit tracking counters for shared rate limiter';

-- ============================================================================
-- ATOMIC INCREMENT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_key TEXT,
  p_increment INT,
  p_limit INT
)
RETURNS TABLE(count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INT;
BEGIN
  -- Get current count
  SELECT rate_limit_counters.count INTO current_count
  FROM rate_limit_counters
  WHERE key = p_key;

  -- If not found, return 0 (initialization handled by caller)
  IF current_count IS NULL THEN
    RETURN QUERY SELECT 0::INT;
    RETURN;
  END IF;

  -- Only increment if within limit and window is valid
  IF current_count < p_limit THEN
    UPDATE rate_limit_counters
    SET count = count + p_increment,
        updated_at = now()
    WHERE key = p_key
      AND window_end > now(); -- Only increment if window is still valid
  END IF;
  
  -- Return updated count
  RETURN QUERY
  SELECT rate_limit_counters.count
  FROM rate_limit_counters
  WHERE key = p_key;
END;
$$;

COMMENT ON FUNCTION public.increment_rate_limit IS 'Atomically increment rate limit counter, respecting limit';

GRANT EXECUTE ON FUNCTION public.increment_rate_limit TO service_role;

-- ============================================================================
-- CLEANUP FUNCTION FOR EXPIRED COUNTERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_counters()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM rate_limit_counters
  WHERE window_end < now() - INTERVAL '1 hour'; -- Keep for 1 hour after expiry
END;
$$;

COMMENT ON FUNCTION public.cleanup_rate_limit_counters IS 'Clean up expired rate limit counters (run via pg_cron)';

GRANT EXECUTE ON FUNCTION public.cleanup_rate_limit_counters TO service_role;

-- ============================================================================
-- VERIFY MIGRATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Shared primitives migration complete:';
  RAISE NOTICE '   - rate_limit_counters table created';
  RAISE NOTICE '   - increment_rate_limit function created';
  RAISE NOTICE '   - cleanup_rate_limit_counters function created';
  RAISE NOTICE '   - Indexes added for performance';
END $$;

