-- =====================================================
-- DEBUG: Sponsorship Queue Processing
-- =====================================================
-- Run these queries to understand why nothing was processed

-- 1. Check if queue has any items
SELECT 
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE processed_at IS NULL) as pending,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL) as processed
FROM fit_recalc_queue;

-- 2. See what's in the queue
SELECT * FROM fit_recalc_queue ORDER BY queued_at DESC LIMIT 10;

-- 3. Check if sponsors exist
SELECT COUNT(*) as sponsor_count FROM sponsors;
SELECT * FROM sponsors LIMIT 5;

-- 4. Check if sponsor profiles exist
SELECT COUNT(*) as profile_count FROM sponsor_profiles;
SELECT * FROM sponsor_profiles LIMIT 5;

-- 5. Check if events exist
SELECT COUNT(*) as event_count FROM events;
SELECT id, title FROM events LIMIT 5;

-- 6. Check if event insights exist
SELECT COUNT(*) as insights_count FROM event_audience_insights;
SELECT * FROM event_audience_insights LIMIT 5;

-- 7. Check if any matches exist
SELECT COUNT(*) as match_count FROM sponsorship_matches;
SELECT * FROM sponsorship_matches LIMIT 5;

-- =====================================================
-- If queue is empty, manually queue some calculations:
-- =====================================================

-- Queue calculations for all sponsor-event pairs
INSERT INTO fit_recalc_queue (event_id, sponsor_id, reason, queued_at)
SELECT 
  e.id,
  sp.sponsor_id,
  'manual_debug' as reason,
  now() as queued_at
FROM events e
CROSS JOIN sponsor_profiles sp
WHERE NOT EXISTS (
  SELECT 1 FROM fit_recalc_queue q
  WHERE q.event_id = e.id 
  AND q.sponsor_id = sp.sponsor_id
  AND q.processed_at IS NULL
)
LIMIT 10;

-- Now check queue again
SELECT COUNT(*) FROM fit_recalc_queue WHERE processed_at IS NULL;

