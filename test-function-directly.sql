-- =====================================================
-- DIRECT TEST: Call the function manually to see exact error
-- =====================================================

-- Get real IDs from your data
SELECT 
  'Test Data' as step,
  (SELECT id FROM events LIMIT 1) as event_id,
  (SELECT sponsor_id FROM sponsor_profiles LIMIT 1) as sponsor_id;

-- Test the function directly with those IDs
-- Replace with actual IDs from above result
DO $$
DECLARE
  v_event_id uuid := (SELECT id FROM events LIMIT 1);
  v_sponsor_id uuid := (SELECT sponsor_id FROM sponsor_profiles LIMIT 1);
  v_result record;
BEGIN
  RAISE NOTICE 'Testing match_score with event: %, sponsor: %', v_event_id, v_sponsor_id;
  
  -- Call the function
  SELECT * INTO v_result FROM fn_compute_match_score(v_event_id, v_sponsor_id);
  
  RAISE NOTICE 'SUCCESS! Score: %', v_result.score;
  RAISE NOTICE 'Breakdown: %', v_result.breakdown;
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ ERROR: %', SQLERRM;
  RAISE WARNING 'SQL STATE: %', SQLSTATE;
  RAISE WARNING 'CONTEXT: %', SQLSTATE;
END $$;

-- =====================================================
-- Also test fn_upsert_match directly
-- =====================================================
DO $$
DECLARE
  v_event_id uuid := (SELECT id FROM events LIMIT 1);
  v_sponsor_id uuid := (SELECT sponsor_id FROM sponsor_profiles LIMIT 1);
BEGIN
  RAISE NOTICE 'Testing fn_upsert_match...';
  
  PERFORM fn_upsert_match(v_event_id, v_sponsor_id);
  
  RAISE NOTICE 'Upsert completed';
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '❌ UPSERT ERROR: %', SQLERRM;
END $$;

-- Check if match was created
SELECT 'After Manual Test' as step, COUNT(*) as matches FROM sponsorship_matches;

