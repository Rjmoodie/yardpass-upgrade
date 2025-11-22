-- ============================================================
-- Delete 6 Duplicate Events - Final Cleanup
-- ============================================================
-- This will delete 6 duplicate events, keeping 2 most recent ones
-- ============================================================

-- STEP 1: Preview what will be deleted
WITH ranked_events AS (
  SELECT 
    e.id,
    e.title,
    e.owner_context_id as org_id,
    e.created_at,
    e.slug,
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
  created_at
FROM ranked_events
ORDER BY title, created_at DESC;

-- ============================================================
-- STEP 2: DELETE 6 DUPLICATES (UNCOMMENT TO EXECUTE)
-- ============================================================
-- This deletes 6 older duplicate events
-- Keeps 2 most recent ones (one per duplicate group)
-- ============================================================

/*
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
DELETE FROM events.events
WHERE id IN (
  SELECT id FROM ranked_events WHERE rn > 1
);
*/

-- STEP 3: Verify deletion (should return 0)
SELECT 
  'FINAL VERIFICATION' as step,
  COUNT(*) as remaining_duplicates
FROM (
  SELECT 
    e.title,
    e.owner_context_id,
    COUNT(*) as cnt
  FROM events.events e
  WHERE e.owner_context_id IS NOT NULL
  GROUP BY e.title, e.owner_context_id
  HAVING COUNT(*) > 1
) duplicates;

-- Should return 0 if all duplicates were removed successfully!

