-- Fix guest feed: Ensure get_home_feed_ids can read public events for guests
-- Issue: When called with anon permissions, RLS might block event queries in the SQL function
-- Solution: Add SECURITY DEFINER so function can read all public events
-- This is safe because the function already filters by visibility = 'public'

-- Use DO block to alter all overloaded versions of the functions
-- This avoids needing to know the exact function signatures

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Alter all versions of get_home_feed_ids
    FOR r IN 
        SELECT oid::regprocedure AS func_sig
        FROM pg_proc 
        WHERE proname = 'get_home_feed_ids' 
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', r.func_sig);
        RAISE NOTICE 'Altered function: %', r.func_sig;
    END LOOP;
    
    -- Alter all versions of get_home_feed_ranked
    FOR r IN 
        SELECT oid::regprocedure AS func_sig
        FROM pg_proc 
        WHERE proname = 'get_home_feed_ranked' 
          AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', r.func_sig);
        RAISE NOTICE 'Altered function: %', r.func_sig;
    END LOOP;
END $$;

COMMENT ON FUNCTION public.get_home_feed_ids IS 'Core feed algorithm - SECURITY DEFINER allows reading all public events for guest users. Function filters by visibility = public so this is safe.';
COMMENT ON FUNCTION public.get_home_feed_ranked IS 'Feed ranking wrapper - includes events AND posts. SECURITY DEFINER ensures guest users can see public events.';

