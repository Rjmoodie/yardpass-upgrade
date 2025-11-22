-- ============================================================
-- Find ALL Remaining Duplicates (No Time Window)
-- ============================================================
-- This finds duplicates regardless of when they were created
-- ============================================================

-- STEP 1: Find all duplicate groups (by title + org, no time limit)
SELECT 
  'ALL DUPLICATE GROUPS' as step,
  e.title,
  e.owner_context_id as org_id,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(e.id ORDER BY e.created_at DESC) as event_ids,
  ARRAY_AGG(e.created_at ORDER BY e.created_at DESC) as created_dates,
  MAX(e.created_at) as most_recent,
  MIN(e.created_at) as oldest
FROM events.events e
WHERE e.owner_context_id IS NOT NULL
GROUP BY e.title, e.owner_context_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- STEP 2: Show detail of each duplicate (what to keep vs delete)
WITH ranked_events AS (
  SELECT 
    e.id,
    e.title,
    e.owner_context_id as org_id,
    e.created_at,
    e.slug,
    e.idempotency_key,
    ROW_NUMBER() OVER (
      PARTITION BY e.title, e.owner_context_id
      ORDER BY e.created_at DESC
    ) as rn
  FROM events.events e
  WHERE e.owner_context_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM events.events e2
      WHERE e2.id != e.id
        AND e2.title = e.title
        AND e2.owner_context_id = e.owner_context_id
    )
)
SELECT 
  CASE WHEN rn = 1 THEN '✓ KEEP (most recent)' ELSE '✗ DELETE (duplicate)' END as action,
  id,
  title,
  org_id,
  slug,
  created_at,
  idempotency_key
FROM ranked_events
ORDER BY title, created_at DESC;

-- STEP 3: Count how many will be deleted
WITH ranked_events AS (
  SELECT 
    e.id,
    ROW_NUMBER() OVER (
      PARTITION BY e.title, e.owner_context_id
      ORDER BY e.created_at DESC
    ) as rn
  FROM events.events e
  WHERE e.owner_context_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM events.events e2
      WHERE e2.id != e.id
        AND e2.title = e.title
        AND e2.owner_context_id = e.owner_context_id
    )
)
SELECT 
  COUNT(*) FILTER (WHERE rn = 1) as events_to_keep,
  COUNT(*) FILTER (WHERE rn > 1) as events_to_delete,
  COUNT(*) as total_duplicates
FROM ranked_events;

