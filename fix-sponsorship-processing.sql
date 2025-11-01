-- =====================================================
-- FIX: Sponsorship Processing Issues
-- =====================================================

-- STEP 1: Check what data we have
-- =====================================================
SELECT 'Data Inventory' as check_name;

SELECT 'sponsors' as item, COUNT(*) as count FROM sponsors
UNION ALL
SELECT 'sponsor_profiles', COUNT(*) FROM sponsor_profiles
UNION ALL  
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'event_audience_insights', COUNT(*) FROM event_audience_insights;

-- STEP 2: Get a sample queue item
-- =====================================================
SELECT 'Sample Queue Item' as check_name;

SELECT * FROM fit_recalc_queue 
WHERE processed_at IS NULL 
LIMIT 1;

-- STEP 3: Test the scoring function manually
-- =====================================================
-- First, get valid IDs
SELECT 'Test IDs' as check_name;

WITH test_data AS (
  SELECT 
    (SELECT id FROM events LIMIT 1) as event_id,
    (SELECT sponsor_id FROM sponsor_profiles LIMIT 1) as sponsor_id
)
SELECT 
  event_id,
  sponsor_id,
  -- Check if event exists
  (SELECT title FROM events WHERE id = test_data.event_id) as event_title,
  -- Check if sponsor exists
  (SELECT name FROM sponsors WHERE id = test_data.sponsor_id) as sponsor_name,
  -- Check if profile exists
  (SELECT industry FROM sponsor_profiles WHERE sponsor_id = test_data.sponsor_id) as sponsor_industry,
  -- Check if insights exist
  (SELECT engagement_score FROM event_audience_insights WHERE event_id = test_data.event_id) as event_engagement
FROM test_data;

-- STEP 4: Try calling the function with actual IDs
-- =====================================================
SELECT 'Attempting Match Calculation' as check_name;

-- This will show you the exact error if it fails
DO $$
DECLARE
  v_event_id uuid;
  v_sponsor_id uuid;
  v_result record;
BEGIN
  -- Get IDs
  SELECT id INTO v_event_id FROM events LIMIT 1;
  SELECT sponsor_id INTO v_sponsor_id FROM sponsor_profiles LIMIT 1;
  
  RAISE NOTICE 'Testing with event_id: %, sponsor_id: %', v_event_id, v_sponsor_id;
  
  -- Check event exists
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = v_event_id) THEN
    RAISE WARNING 'Event % does not exist', v_event_id;
    RETURN;
  END IF;
  
  -- Check sponsor exists
  IF NOT EXISTS (SELECT 1 FROM sponsors WHERE id = v_sponsor_id) THEN
    RAISE WARNING 'Sponsor % does not exist', v_sponsor_id;
    RETURN;
  END IF;
  
  -- Check profile exists
  IF NOT EXISTS (SELECT 1 FROM sponsor_profiles WHERE sponsor_id = v_sponsor_id) THEN
    RAISE WARNING 'Sponsor profile for % does not exist', v_sponsor_id;
    RETURN;
  END IF;
  
  -- Try to compute score
  BEGIN
    SELECT * INTO v_result FROM fn_compute_match_score(v_event_id, v_sponsor_id);
    RAISE NOTICE 'SUCCESS! Score: %, Breakdown: %', v_result.score, v_result.breakdown;
    
    -- Try to upsert
    PERFORM fn_upsert_match(v_event_id, v_sponsor_id);
    RAISE NOTICE 'Match upserted successfully';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'ERROR in scoring function: %', SQLERRM;
    RAISE WARNING 'DETAIL: %', SQLSTATE;
  END;
END $$;

-- STEP 5: Check if match was created
-- =====================================================
SELECT COUNT(*) as matches_created FROM sponsorship_matches;

SELECT * FROM sponsorship_matches LIMIT 5;

-- STEP 6: Check queue status after manual test
-- =====================================================
SELECT 
  COUNT(*) FILTER (WHERE processed_at IS NULL) as still_pending,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL) as now_processed
FROM fit_recalc_queue;

