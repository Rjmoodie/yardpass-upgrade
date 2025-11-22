-- ============================================================
-- Remove Duplicate Events - Safe Approach
-- ============================================================
-- Purpose: Identify and safely remove duplicate events from Event pipeline
-- Strategy: Keep the most recent event per idempotency_key or title+org combo
-- ============================================================

-- STEP 1: Find events with same idempotency_key (true duplicates)
SELECT 
  'DUPLICATES BY IDEMPOTENCY KEY' as check_type,
  idempotency_key,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id ORDER BY created_at DESC) as event_ids,
  ARRAY_AGG(title ORDER BY created_at DESC) as titles,
  ARRAY_AGG(created_at ORDER BY created_at DESC) as created_dates
FROM events.events
WHERE idempotency_key IS NOT NULL
GROUP BY idempotency_key
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- STEP 2: Find events with same title, org, and similar creation time (likely duplicates)
SELECT 
  'DUPLICATES BY TITLE+ORG+TIME' as check_type,
  title,
  owner_context_id as org_id,
  COUNT(*) as duplicate_count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest,
  (MAX(created_at) - MIN(created_at)) as time_span,
  ARRAY_AGG(id ORDER BY created_at DESC) as event_ids,
  ARRAY_AGG(created_at ORDER BY created_at DESC) as created_dates
FROM events.events
WHERE owner_context_id IS NOT NULL
  AND created_at > NOW() - INTERVAL '7 days'  -- Only check recent duplicates
GROUP BY title, owner_context_id
HAVING COUNT(*) > 1
  AND (MAX(created_at) - MIN(created_at)) < INTERVAL '1 hour'  -- Created within 1 hour of each other
ORDER BY duplicate_count DESC, newest DESC;

-- STEP 3: Preview what will be deleted (KEEP most recent, DELETE older)
WITH duplicates AS (
  SELECT 
    id,
    title,
    owner_context_id as org_id,
    idempotency_key,
    created_at,
    slug,
    -- Group by idempotency_key first, then by title+org
    COALESCE(
      ROW_NUMBER() OVER (
        PARTITION BY idempotency_key 
        ORDER BY created_at DESC
      ),
      ROW_NUMBER() OVER (
        PARTITION BY title, owner_context_id 
        ORDER BY created_at DESC
      )
    ) as rn
  FROM events.events
  WHERE (
    -- Events with duplicate idempotency_key
    idempotency_key IN (
      SELECT idempotency_key 
      FROM events.events 
      WHERE idempotency_key IS NOT NULL
      GROUP BY idempotency_key 
      HAVING COUNT(*) > 1
    )
    OR
    -- Events with duplicate title+org created within 1 hour
    (title, owner_context_id) IN (
      SELECT title, owner_context_id
      FROM events.events
      WHERE owner_context_id IS NOT NULL
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY title, owner_context_id
      HAVING COUNT(*) > 1
        AND (MAX(created_at) - MIN(created_at)) < INTERVAL '1 hour'
    )
  )
)
SELECT 
  CASE 
    WHEN rn = 1 THEN '✓ KEEP (most recent)'
    ELSE '✗ DELETE (duplicate)'
  END as action,
  id,
  title,
  org_id,
  idempotency_key,
  created_at,
  slug
FROM duplicates
ORDER BY 
  COALESCE(idempotency_key, title || owner_context_id::text),
  created_at DESC;

-- STEP 4: Count how many duplicates will be deleted
WITH duplicates AS (
  SELECT 
    id,
    COALESCE(
      ROW_NUMBER() OVER (
        PARTITION BY idempotency_key 
        ORDER BY created_at DESC
      ),
      ROW_NUMBER() OVER (
        PARTITION BY title, owner_context_id 
        ORDER BY created_at DESC
      )
    ) as rn
  FROM events.events
  WHERE (
    idempotency_key IN (
      SELECT idempotency_key 
      FROM events.events 
      WHERE idempotency_key IS NOT NULL
      GROUP BY idempotency_key 
      HAVING COUNT(*) > 1
    )
    OR
    (title, owner_context_id) IN (
      SELECT title, owner_context_id
      FROM events.events
      WHERE owner_context_id IS NOT NULL
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY title, owner_context_id
      HAVING COUNT(*) > 1
        AND (MAX(created_at) - MIN(created_at)) < INTERVAL '1 hour'
    )
  )
)
SELECT 
  'SUMMARY' as step,
  COUNT(*) FILTER (WHERE rn = 1) as events_to_keep,
  COUNT(*) FILTER (WHERE rn > 1) as events_to_delete,
  COUNT(*) as total_duplicate_events
FROM duplicates;

-- ============================================================
-- STEP 5: DELETE DUPLICATES (UNCOMMENT TO EXECUTE)
-- ============================================================
-- WARNING: This will permanently delete duplicate events!
-- Run steps 1-4 first to verify what will be deleted
-- ============================================================

/*
WITH duplicates AS (
  SELECT 
    id,
    COALESCE(
      ROW_NUMBER() OVER (
        PARTITION BY idempotency_key 
        ORDER BY created_at DESC
      ),
      ROW_NUMBER() OVER (
        PARTITION BY title, owner_context_id 
        ORDER BY created_at DESC
      )
    ) as rn
  FROM events.events
  WHERE (
    idempotency_key IN (
      SELECT idempotency_key 
      FROM events.events 
      WHERE idempotency_key IS NOT NULL
      GROUP BY idempotency_key 
      HAVING COUNT(*) > 1
    )
    OR
    (title, owner_context_id) IN (
      SELECT title, owner_context_id
      FROM events.events
      WHERE owner_context_id IS NOT NULL
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY title, owner_context_id
      HAVING COUNT(*) > 1
        AND (MAX(created_at) - MIN(created_at)) < INTERVAL '1 hour'
    )
  )
)
DELETE FROM events.events
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
*/

-- STEP 6: Verify deletion (run after deletion)
SELECT 
  'VERIFICATION' as step,
  'Remaining duplicates' as check_type,
  COUNT(*) as duplicate_count
FROM (
  SELECT 
    COALESCE(idempotency_key, title || owner_context_id::text) as duplicate_key,
    COUNT(*) as cnt
  FROM events.events
  WHERE (
    idempotency_key IN (
      SELECT idempotency_key 
      FROM events.events 
      WHERE idempotency_key IS NOT NULL
      GROUP BY idempotency_key 
      HAVING COUNT(*) > 1
    )
    OR
    (title, owner_context_id) IN (
      SELECT title, owner_context_id
      FROM events.events
      WHERE owner_context_id IS NOT NULL
        AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY title, owner_context_id
      HAVING COUNT(*) > 1
        AND (MAX(created_at) - MIN(created_at)) < INTERVAL '1 hour'
    )
  )
  GROUP BY duplicate_key
  HAVING COUNT(*) > 1
) subquery;

-- If this returns 0, all duplicates have been removed successfully!

