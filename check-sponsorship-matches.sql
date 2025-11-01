-- =====================================================
-- CHECK: Sponsorship Matches Created
-- =====================================================

-- 1. Check if matches were created
SELECT 
  COUNT(*) as total_matches,
  COUNT(*) FILTER (WHERE score >= 0.7) as excellent_matches,
  COUNT(*) FILTER (WHERE score >= 0.5) as good_matches,
  AVG(score) as avg_score
FROM sponsorship_matches;

-- 2. View top matches
SELECT 
  s.name as sponsor_name,
  s.industry,
  sm.score,
  ROUND(sm.score * 100) as match_percent,
  sm.overlap_metrics->>'budget_fit' as budget_fit,
  sm.overlap_metrics->'audience_overlap'->>'combined' as audience_match,
  sm.status,
  sm.updated_at
FROM sponsorship_matches sm
JOIN sponsors s ON s.id = sm.sponsor_id
ORDER BY sm.score DESC
LIMIT 10;

-- 3. Check queue processing status
SELECT 
  COUNT(*) as total_queued,
  COUNT(*) FILTER (WHERE processed_at IS NULL) as still_pending,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL) as processed
FROM fit_recalc_queue;

-- 4. View recent queue activity
SELECT 
  reason,
  queued_at,
  processed_at,
  EXTRACT(EPOCH FROM (processed_at - queued_at)) as processing_time_seconds
FROM fit_recalc_queue
WHERE processed_at IS NOT NULL
ORDER BY processed_at DESC
LIMIT 10;

-- =====================================================
-- If no matches, try processing via DB function:
-- =====================================================
SELECT process_match_queue(100);

-- Then check matches again:
SELECT COUNT(*) FROM sponsorship_matches;

