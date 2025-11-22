-- ============================================================
-- Remove Duplicate Events - Quick Action
-- ============================================================
-- This script removes duplicate events, keeping the most recent one
-- Run each step sequentially to see what will be deleted first
-- ============================================================

-- STEP 1: See all duplicates (title + org combo)
SELECT 
  title,
  owner_context_id as org_id,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(id ORDER BY created_at DESC) as event_ids,
  ARRAY_AGG(created_at ORDER BY created_at DESC) as created_dates,
  MAX(created_at) as most_recent_id,
  MIN(created_at) as oldest_created
FROM events.events
WHERE owner_context_id IS NOT NULL
GROUP BY title, owner_context_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- STEP 2: Preview exactly what will be deleted (KEEP newest, DELETE older)
WITH ranked_events AS (
  SELECT 
    e.id,
    e.title,
    e.owner_context_id as org_id,
    e.created_at,
    e.slug,
    e.idempotency_key,
    ROW_NUMBER() OVER (
      PARTITION BY 
        COALESCE(e.idempotency_key, e.title || '|' || e.owner_context_id::text)
      ORDER BY e.created_at DESC
    ) as rn
  FROM events.events e
  WHERE e.owner_context_id IS NOT NULL
)
SELECT 
  CASE WHEN rn = 1 THEN '✓ KEEP' ELSE '✗ DELETE' END as action,
  id,
  title,
  org_id,
  idempotency_key,
  created_at,
  slug
FROM ranked_events
WHERE id IN (
  -- Only show events that have duplicates
  SELECT e1.id
  FROM events.events e1
  WHERE EXISTS (
    SELECT 1 FROM events.events e2
    WHERE e2.id != e1.id
      AND (
        (e1.idempotency_key IS NOT NULL AND e2.idempotency_key = e1.idempotency_key)
        OR (
          e1.idempotency_key IS NULL 
          AND e1.title = e2.title 
          AND e1.owner_context_id = e2.owner_context_id
          AND ABS(EXTRACT(EPOCH FROM (e1.created_at - e2.created_at))) < 3600  -- Within 1 hour
        )
      )
  )
)
ORDER BY 
  COALESCE(ranked_events.idempotency_key, ranked_events.title || '|' || ranked_events.org_id::text),
  ranked_events.created_at DESC;

-- STEP 3: Count how many will be deleted
WITH ranked_events AS (
  SELECT 
    e1.id,
    COALESCE(e1.idempotency_key, e1.title || '|' || e1.owner_context_id::text) as dup_key,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(e1.idempotency_key, e1.title || '|' || e1.owner_context_id::text)
      ORDER BY e1.created_at DESC
    ) as rn
  FROM events.events e1
  WHERE e1.owner_context_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM events.events e2
      WHERE e2.id != e1.id
        AND (
          (e1.idempotency_key IS NOT NULL AND e2.idempotency_key = e1.idempotency_key)
          OR (
            e1.idempotency_key IS NULL 
            AND e1.title = e2.title 
            AND e1.owner_context_id = e2.owner_context_id
            AND ABS(EXTRACT(EPOCH FROM (e1.created_at - e2.created_at))) < 3600
          )
        )
    )
)
SELECT 
  COUNT(*) FILTER (WHERE rn = 1) as events_to_keep,
  COUNT(*) FILTER (WHERE rn > 1) as events_to_delete,
  COUNT(*) as total_duplicates
FROM ranked_events;

-- ============================================================
-- STEP 4: DELETE DUPLICATES (UNCOMMENT TO EXECUTE)
-- ============================================================
-- WARNING: This will permanently delete duplicate events!
-- Make sure you've reviewed steps 1-3 first!
-- ============================================================

/*
WITH ranked_events AS (
  SELECT 
    e1.id,
    COALESCE(e1.idempotency_key, e1.title || '|' || e1.owner_context_id::text) as dup_key,
    ROW_NUMBER() OVER (
      PARTITION BY COALESCE(e1.idempotency_key, e1.title || '|' || e1.owner_context_id::text)
      ORDER BY e1.created_at DESC
    ) as rn
  FROM events.events e1
  WHERE e1.owner_context_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM events.events e2
      WHERE e2.id != e1.id
        AND (
          (e1.idempotency_key IS NOT NULL AND e2.idempotency_key = e1.idempotency_key)
          OR (
            e1.idempotency_key IS NULL 
            AND e1.title = e2.title 
            AND e1.owner_context_id = e2.owner_context_id
            AND ABS(EXTRACT(EPOCH FROM (e1.created_at - e2.created_at))) < 3600
          )
        )
    )
)
DELETE FROM events.events
WHERE id IN (
  SELECT id FROM ranked_events WHERE rn > 1
);
*/

-- STEP 5: Verify no duplicates remain (run after deletion)
SELECT 
  'VERIFICATION' as step,
  COUNT(*) as remaining_duplicates
FROM (
  SELECT 
    COALESCE(e.idempotency_key, e.title || '|' || e.owner_context_id::text) as dup_key,
    COUNT(*) as cnt
  FROM events.events e
  WHERE e.owner_context_id IS NOT NULL
  GROUP BY dup_key
  HAVING COUNT(*) > 1
) duplicates;

-- Should return 0 if all duplicates were removed successfully!

-- ============================================================
-- BONUS: Show the 2 remaining duplicates
-- ============================================================
SELECT 
  'REMAINING DUPLICATES DETAIL' as step,
  COALESCE(e.idempotency_key, e.title || '|' || e.owner_context_id::text) as dup_key,
  e.id,
  e.title,
  e.owner_context_id as org_id,
  e.idempotency_key,
  e.created_at,
  e.slug,
  COUNT(*) OVER (PARTITION BY COALESCE(e.idempotency_key, e.title || '|' || e.owner_context_id::text)) as duplicate_count,
  ROW_NUMBER() OVER (
    PARTITION BY COALESCE(e.idempotency_key, e.title || '|' || e.owner_context_id::text)
    ORDER BY e.created_at DESC
  ) as rn
FROM events.events e
WHERE e.owner_context_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM events.events e2
    WHERE e2.id != e.id
      AND (
        (e.idempotency_key IS NOT NULL AND e2.idempotency_key = e.idempotency_key)
        OR (
          e.idempotency_key IS NULL 
          AND e.title = e2.title 
          AND e.owner_context_id = e2.owner_context_id
          AND ABS(EXTRACT(EPOCH FROM (e.created_at - e2.created_at))) < 3600
        )
      )
  )
ORDER BY dup_key, e.created_at DESC;

