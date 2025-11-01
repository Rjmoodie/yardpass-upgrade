-- =====================================================
-- DEBUG: Why No Matches Were Created
-- =====================================================

-- 1. Check all required data exists
SELECT 'sponsors' as table_name, COUNT(*) as count FROM sponsors
UNION ALL
SELECT 'sponsor_profiles', COUNT(*) FROM sponsor_profiles
UNION ALL
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'event_audience_insights', COUNT(*) FROM event_audience_insights
UNION ALL
SELECT 'sponsorship_matches', COUNT(*) FROM sponsorship_matches
UNION ALL
SELECT 'fit_recalc_queue (pending)', COUNT(*) FROM fit_recalc_queue WHERE processed_at IS NULL;

-- 2. Check if queue items have valid references
SELECT 
  'Valid event_id' as check_type,
  COUNT(*) as count
FROM fit_recalc_queue q
WHERE EXISTS (SELECT 1 FROM events e WHERE e.id = q.event_id)
AND processed_at IS NULL;

SELECT 
  'Valid sponsor_id' as check_type,
  COUNT(*) as count
FROM fit_recalc_queue q
WHERE EXISTS (SELECT 1 FROM sponsor_profiles sp WHERE sp.sponsor_id = q.sponsor_id)
AND processed_at IS NULL;

-- 3. Check if events have insights
SELECT 
  e.id as event_id,
  e.title,
  CASE WHEN eai.event_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_insights
FROM events e
LEFT JOIN event_audience_insights eai ON eai.event_id = e.id
LIMIT 10;

-- 4. Check if sponsors have profiles
SELECT 
  s.id as sponsor_id,
  s.name,
  CASE WHEN sp.sponsor_id IS NOT NULL THEN 'YES' ELSE 'NO' END as has_profile
FROM sponsors s
LEFT JOIN sponsor_profiles sp ON sp.sponsor_id = s.id
LIMIT 10;

-- 5. Try to manually compute ONE match score
-- Get first event and sponsor
DO $$
DECLARE
  test_event_id uuid;
  test_sponsor_id uuid;
  result record;
BEGIN
  -- Get first event
  SELECT id INTO test_event_id FROM events LIMIT 1;
  
  -- Get first sponsor
  SELECT sponsor_id INTO test_sponsor_id FROM sponsor_profiles LIMIT 1;
  
  IF test_event_id IS NOT NULL AND test_sponsor_id IS NOT NULL THEN
    RAISE NOTICE 'Testing match score for event % and sponsor %', test_event_id, test_sponsor_id;
    
    -- Try to compute score
    BEGIN
      SELECT * INTO result FROM fn_compute_match_score(test_event_id, test_sponsor_id);
      RAISE NOTICE 'Score computed successfully: %', result.score;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Error computing score: %', SQLERRM;
    END;
  ELSE
    RAISE WARNING 'Missing event or sponsor data';
  END IF;
END $$;

-- 6. Check if the queue items were marked as processed
SELECT 
  reason,
  COUNT(*) as count,
  MIN(queued_at) as first_queued,
  MAX(queued_at) as last_queued,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL) as processed_count
FROM fit_recalc_queue
GROUP BY reason;

