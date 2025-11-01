-- =====================================================
-- TEST: Manual Match Calculation
-- =====================================================

-- 1. Get a queue item to test with
SELECT 
  id,
  event_id,
  sponsor_id,
  reason
FROM fit_recalc_queue
WHERE processed_at IS NULL
LIMIT 1;

-- 2. Get the event details for that item
-- Replace <event_id> with actual ID from above
SELECT * FROM events WHERE id = '<event_id>';

-- 3. Get sponsor profile for that item
-- Replace <sponsor_id> with actual ID from above
SELECT * FROM sponsor_profiles WHERE sponsor_id = '<sponsor_id>';

-- 4. Get event insights for that item
-- Replace <event_id> with actual ID from above
SELECT * FROM event_audience_insights WHERE event_id = '<event_id>';

-- =====================================================
-- 5. Try to manually compute the match score
-- Replace IDs below with actual values from step 1
-- =====================================================
SELECT * FROM fn_compute_match_score(
  '<event_id>'::uuid,
  '<sponsor_id>'::uuid
);

-- =====================================================
-- 6. If the above works, manually upsert one match
-- =====================================================
SELECT fn_upsert_match(
  '<event_id>'::uuid,
  '<sponsor_id>'::uuid
);

-- Then check if match was created
SELECT * FROM sponsorship_matches 
WHERE event_id = '<event_id>'::uuid 
AND sponsor_id = '<sponsor_id>'::uuid;

-- =====================================================
-- 7. Check Edge Function logs for errors
-- =====================================================
-- Run in terminal:
-- npx supabase functions logs sponsorship-recalc --tail

