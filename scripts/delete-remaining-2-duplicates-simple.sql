-- ============================================================
-- Delete Remaining 2 Duplicate Groups - Simple & Direct
-- ============================================================
-- This script will delete ALL duplicates except the most recent one
-- ============================================================

-- STEP 1: Show exactly what duplicates remain
SELECT 
  'REMAINING DUPLICATES' as step,
  e.title,
  e.owner_context_id as org_id,
  COUNT(*) as duplicate_count,
  MIN(e.created_at) as oldest,
  MAX(e.created_at) as newest,
  ARRAY_AGG(e.id ORDER BY e.created_at DESC) as all_event_ids,
  (ARRAY_AGG(e.id ORDER BY e.created_at DESC))[1] as keep_event_id,
  (ARRAY_AGG(e.id ORDER BY e.created_at DESC))[2:] as delete_event_ids
FROM events.events e
WHERE e.owner_context_id IS NOT NULL
GROUP BY e.title, e.owner_context_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- STEP 2: Show detailed view of what will be kept vs deleted
WITH duplicates AS (
  SELECT 
    e.title,
    e.owner_context_id,
    COUNT(*) as cnt
  FROM events.events e
  WHERE e.owner_context_id IS NOT NULL
  GROUP BY e.title, e.owner_context_id
  HAVING COUNT(*) > 1
),
ranked AS (
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
  INNER JOIN duplicates d ON e.title = d.title AND e.owner_context_id = d.owner_context_id
)
SELECT 
  CASE WHEN rn = 1 THEN '✓ KEEP' ELSE '✗ DELETE' END as action,
  id,
  title,
  org_id,
  slug,
  created_at
FROM ranked
ORDER BY title, created_at DESC;

-- ============================================================
-- STEP 3: DELETE ALL DUPLICATES (UNCOMMENT TO EXECUTE)
-- ============================================================
-- This will delete ALL duplicate events, keeping only the most recent
-- ============================================================

/*
-- Method 1: Using CTE (recommended)
WITH duplicates AS (
  SELECT 
    e.title,
    e.owner_context_id
  FROM events.events e
  WHERE e.owner_context_id IS NOT NULL
  GROUP BY e.title, e.owner_context_id
  HAVING COUNT(*) > 1
),
ranked AS (
  SELECT 
    e.id,
    ROW_NUMBER() OVER (
      PARTITION BY e.title, e.owner_context_id
      ORDER BY e.created_at DESC
    ) as rn
  FROM events.events e
  INNER JOIN duplicates d ON e.title = d.title AND e.owner_context_id = d.owner_context_id
)
DELETE FROM events.events
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);
*/

-- Method 2: Direct subquery (simpler, no CTE)
/*
DELETE FROM events.events
WHERE id IN (
  SELECT e.id
  FROM events.events e
  WHERE e.owner_context_id IS NOT NULL
    AND EXISTS (
      SELECT 1 
      FROM events.events e2
      WHERE e2.title = e.title
        AND e2.owner_context_id = e.owner_context_id
        AND e2.created_at > e.created_at  -- Keep only if there's a newer one
    )
);
*/

-- STEP 4: Final verification (should return 0)
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

