-- ============================================================
-- Check and Delete Final 2 Duplicate Groups
-- ============================================================
-- This will show exactly what the 2 remaining duplicate groups are
-- and provide a direct DELETE with proper RLS handling
-- ============================================================

-- STEP 1: See exactly what the 2 remaining duplicate groups are
SELECT 
  'REMAINING DUPLICATES' as step,
  e.title,
  e.owner_context_id as org_id,
  COUNT(*) as duplicate_count,
  MIN(e.created_at) as oldest,
  MAX(e.created_at) as newest,
  ARRAY_AGG(e.id ORDER BY e.created_at DESC) as event_ids,
  (ARRAY_AGG(e.id ORDER BY e.created_at DESC))[1] as keep_id,
  ARRAY_LENGTH((ARRAY_AGG(e.id ORDER BY e.created_at DESC))[2:], 1) as delete_count
FROM events.events e
WHERE e.owner_context_id IS NOT NULL
GROUP BY e.title, e.owner_context_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- STEP 2: Show detailed view with IDs for manual verification
SELECT 
  e.id,
  e.title,
  e.owner_context_id as org_id,
  e.created_at,
  e.slug,
  ROW_NUMBER() OVER (
    PARTITION BY e.title, e.owner_context_id
    ORDER BY e.created_at DESC
  ) as rn,
  CASE 
    WHEN ROW_NUMBER() OVER (
      PARTITION BY e.title, e.owner_context_id
      ORDER BY e.created_at DESC
    ) = 1 THEN '✓ KEEP (most recent)'
    ELSE '✗ DELETE (duplicate)'
  END as action
FROM events.events e
WHERE e.owner_context_id IS NOT NULL
  AND (e.title, e.owner_context_id) IN (
    SELECT e2.title, e2.owner_context_id
    FROM events.events e2
    WHERE e2.owner_context_id IS NOT NULL
    GROUP BY e2.title, e2.owner_context_id
    HAVING COUNT(*) > 1
  )
ORDER BY e.title, e.created_at DESC;

-- ============================================================
-- STEP 3: DELETE using direct subquery (works with RLS)
-- ============================================================
-- This uses a subquery to identify duplicates and delete them
-- ============================================================

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
        AND e2.created_at > e.created_at  -- There's a newer one, so delete this older one
    )
);
*/

-- Alternative: Using window function (might be more reliable)
/*
DELETE FROM events.events
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      e.id,
      ROW_NUMBER() OVER (
        PARTITION BY e.title, e.owner_context_id
        ORDER BY e.created_at DESC
      ) as rn
    FROM events.events e
    WHERE e.owner_context_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM events.events e2
        WHERE e2.title = e.title
          AND e2.owner_context_id = e.owner_context_id
          AND e2.id != e.id
      )
  ) ranked
  WHERE rn > 1  -- Delete all except the first (most recent)
);
*/

-- STEP 4: Verify deletion (should return 0)
SELECT 
  'FINAL VERIFICATION' as step,
  COUNT(*) as remaining_duplicate_groups
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

