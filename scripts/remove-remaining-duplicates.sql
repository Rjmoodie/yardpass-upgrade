-- ============================================================
-- Remove Remaining 2 Duplicate Groups
-- ============================================================
-- This script will show and delete the remaining 2 duplicate groups
-- ============================================================

-- STEP 1: Show what the 2 remaining duplicates are
SELECT 
  'REMAINING DUPLICATES' as step,
  COALESCE(e.idempotency_key, e.title || '|' || e.owner_context_id::text) as dup_key,
  e.id,
  e.title,
  e.owner_context_id as org_id,
  e.idempotency_key,
  e.created_at,
  e.slug,
  CASE 
    WHEN ROW_NUMBER() OVER (
      PARTITION BY COALESCE(e.idempotency_key, e.title || '|' || e.owner_context_id::text)
      ORDER BY e.created_at DESC
    ) = 1 THEN '✓ KEEP (most recent)'
    ELSE '✗ DELETE (duplicate)'
  END as action
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
ORDER BY 
  COALESCE(e.idempotency_key, e.title || '|' || e.owner_context_id::text),
  e.created_at DESC;

-- STEP 2: Delete the remaining duplicates (UNCOMMENT TO EXECUTE)
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

-- STEP 3: Final verification (should return 0)
SELECT 
  'FINAL VERIFICATION' as step,
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

