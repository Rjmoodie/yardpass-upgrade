-- ============================================================
-- Delete 6 Duplicate Events by ID - Direct & Simple
-- ============================================================
-- This will delete the 6 duplicate events using their exact IDs
-- Keeps 2 most recent events (1 per duplicate group)
-- ============================================================

-- STEP 1: Verify what will be deleted (should match the 6 IDs below)
SELECT 
  'EVENTS TO DELETE' as step,
  e.id,
  e.title,
  e.owner_context_id as org_id,
  e.created_at,
  e.slug,
  '✗ DELETE (duplicate)' as action
FROM events.events e
WHERE e.id IN (
  -- "Liventix Official Event!" - delete 2 older duplicates
  '0f8a9095-d1da-4ba0-b8b0-0de14c28c8ce',  -- Nov 22 15:17:03
  'c9cac60d-ace3-47f0-a118-d3b873643c98',  -- Nov 22 15:16:28
  
  -- "test" - delete 4 older duplicates
  'bbcb1ae7-3c33-4226-86f9-6ab0b859af70',  -- Nov 16 18:39:01
  '2eb6ad7f-b51d-4c4c-bba7-2a262db6fdd8',  -- Nov 16 18:38:50
  '9baf4aa6-1da7-49c1-8bf4-e370e82cffcb',  -- Nov 16 18:38:04
  '80f5177a-0740-4508-b66a-7894209bff49'   -- Nov 16 18:15:49
)
ORDER BY e.title, e.created_at DESC;

-- STEP 2: Show what will be kept (for verification)
SELECT 
  'EVENTS TO KEEP' as step,
  e.id,
  e.title,
  e.owner_context_id as org_id,
  e.created_at,
  e.slug,
  '✓ KEEP (most recent)' as action
FROM events.events e
WHERE e.id IN (
  -- Keep the most recent event from each group
  '28309929-28e7-4bda-af28-6e0b47485ce1',  -- "Liventix Official Event!" - most recent
  'dd1c674a-fcea-4e33-b212-26d34efae2c4'   -- "test" - most recent
)
ORDER BY e.title;

-- ============================================================
-- STEP 3: DELETE 6 DUPLICATES BY ID (UNCOMMENT TO EXECUTE)
-- ============================================================
-- This directly deletes the 6 duplicate events by their IDs
-- ============================================================

/*
DELETE FROM events.events
WHERE id IN (
  -- "Liventix Official Event!" - delete 2 older duplicates
  '0f8a9095-d1da-4ba0-b8b0-0de14c28c8ce',
  'c9cac60d-ace3-47f0-a118-d3b873643c98',
  
  -- "test" - delete 4 older duplicates
  'bbcb1ae7-3c33-4226-86f9-6ab0b859af70',
  '2eb6ad7f-b51d-4c4c-bba7-2a262db6fdd8',
  '9baf4aa6-1da7-49c1-8bf4-e370e82cffcb',
  '80f5177a-0740-4508-b66a-7894209bff49'
);
*/

-- STEP 4: Final verification (should return 0)
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

