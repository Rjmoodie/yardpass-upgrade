-- Migration: Fix checkout_sessions Schema
-- Issue: PGRST204 - cart_snapshot column not found in schema cache
-- Solution: Ensure column exists and reload PostgREST schema cache

-- ============================================================================
-- 1. ENSURE CART_SNAPSHOT COLUMN EXISTS
-- ============================================================================

-- Add cart_snapshot if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'ticketing' 
      AND table_name = 'checkout_sessions' 
      AND column_name = 'cart_snapshot'
  ) THEN
    ALTER TABLE ticketing.checkout_sessions 
    ADD COLUMN cart_snapshot JSONB DEFAULT '{}'::jsonb;
    
    RAISE NOTICE '✅ Added cart_snapshot column to ticketing.checkout_sessions';
  ELSE
    RAISE NOTICE '✅ cart_snapshot column already exists';
  END IF;
END $$;

-- ============================================================================
-- 2. NOTIFY POSTGREST TO RELOAD SCHEMA CACHE
-- ============================================================================

-- PostgREST listens for NOTIFY on 'pgrst' channel
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- 3. VERIFICATION
-- ============================================================================

DO $$
DECLARE
  column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'ticketing' 
      AND table_name = 'checkout_sessions' 
      AND column_name = 'cart_snapshot'
  ) INTO column_exists;
  
  IF column_exists THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ CHECKOUT SESSIONS SCHEMA FIX COMPLETE';
    RAISE NOTICE '✅ cart_snapshot column exists in ticketing.checkout_sessions';
    RAISE NOTICE '✅ PostgREST schema cache notified to reload';
    RAISE NOTICE '';
    RAISE NOTICE '⚡ Enhanced checkout should now work!';
    RAISE NOTICE '   Test by purchasing a ticket.';
    RAISE NOTICE '';
  ELSE
    RAISE EXCEPTION '❌ cart_snapshot column still missing after migration!';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================


