-- ============================================================
-- Find and Remove Duplicate Events
-- ============================================================
-- Purpose: Identify and safely remove duplicate events
-- Strategy: Keep the most recent event, delete older duplicates
-- ============================================================

-- STEP 1: Identify duplicate events by title and organization
-- (Events with same title created by same org are likely duplicates)
SELECT 
  'IDENTIFYING DUPLICATES' as step,
  title,
  owner_context_id as org_id,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id ORDER BY created_at DESC) as event_ids,
  ARRAY_AGG(created_at ORDER BY created_at DESC) as created_dates,
  MAX(created_at) as most_recent,
  MIN(created_at) as oldest
FROM events.events
WHERE owner_context_id IS NOT NULL
GROUP BY title, owner_context_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, most_recent DESC;

-- STEP 2: Preview which events will be KEPT (most recent) vs DELETED
WITH duplicates AS (
  SELECT 
    title,
    owner_context_id as org_id,
    id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY title, owner_context_id 
      ORDER BY created_at DESC
    ) as rn
  FROM events.events
  WHERE owner_context_id IS NOT NULL
)
SELECT 
  'PREVIEW DELETION' as step,
  CASE 
    WHEN rn = 1 THEN '✓ KEEP (most recent)'
    ELSE '✗ DELETE (duplicate)'
  END as action,
  id,
  title,
  owner_context_id as org_id,
  created_at,
  slug
FROM duplicates
WHERE id IN (
  SELECT id FROM duplicates d2
  WHERE d2.rn > 1
    AND EXISTS (
      SELECT 1 FROM duplicates d3
      WHERE d3.title = d2.title
        AND d3.owner_context_id = d2.owner_context_id
        AND d3.rn = 1
    )
)
ORDER BY title, created_at DESC;

-- STEP 3: Delete duplicate events (UNCOMMENT TO EXECUTE)
-- This keeps the most recent event for each title+org combination
/*
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY title, owner_context_id 
      ORDER BY created_at DESC
    ) as rn
  FROM events.events
  WHERE owner_context_id IS NOT NULL
)
DELETE FROM events.events
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
*/

-- STEP 4: Verify deletion (run after deletion)
SELECT 
  'VERIFICATION' as step,
  title,
  owner_context_id as org_id,
  COUNT(*) as remaining_count
FROM events.events
WHERE owner_context_id IS NOT NULL
GROUP BY title, owner_context_id
HAVING COUNT(*) > 1;

-- If this returns 0 rows, all duplicates have been removed successfully!

