-- ============================================================
-- Delete Duplicates - Direct & Simple
-- ============================================================
-- This deletes duplicates by finding events with newer versions
-- ============================================================

-- STEP 1: See what will be deleted (events that have a newer duplicate)
SELECT 
  'EVENTS TO DELETE' as step,
  e.id,
  e.title,
  e.owner_context_id as org_id,
  e.created_at,
  e.slug,
  'Has a newer event with same title+org' as reason
FROM events.events e
WHERE e.owner_context_id IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM events.events e2
    WHERE e2.title = e.title
      AND e2.owner_context_id = e.owner_context_id
      AND e2.created_at > e.created_at  -- There's a newer one
  )
ORDER BY e.title, e.created_at DESC;

-- ============================================================
-- STEP 2: DELETE DUPLICATES (UNCOMMENT TO EXECUTE)
-- ============================================================
-- This deletes any event that has a newer version with same title+org
-- ============================================================

/*
DELETE FROM events.events
WHERE owner_context_id IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM events.events e2
    WHERE e2.title = events.events.title
      AND e2.owner_context_id = events.events.owner_context_id
      AND e2.created_at > events.events.created_at  -- Delete if there's a newer one
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

