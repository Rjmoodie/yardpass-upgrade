-- ============================================================
-- Delete Remaining 2 Duplicate Groups
-- ============================================================
-- This script deletes the 2 remaining duplicate groups
-- Keep most recent, delete older duplicates
-- ============================================================

-- STEP 1: Preview what will be deleted
SELECT 
  CASE 
    WHEN id IN (
      '28309929-28e7-4bda-af28-6e0b47485ce1',  -- Most recent "Liventix Official Event!"
      'dd1c674a-fcea-4e33-b212-26d34efae2c4'   -- Most recent "test"
    ) THEN '✓ KEEP (most recent)'
    ELSE '✗ DELETE (duplicate)'
  END as action,
  id,
  title,
  slug,
  created_at,
  owner_context_id as org_id
FROM events.events
WHERE id IN (
  -- "Liventix Official Event!" duplicates
  '28309929-28e7-4bda-af28-6e0b47485ce1',  -- Keep (Nov 22 15:17:12)
  '0f8a9095-d1da-4ba0-b8b0-0de14c28c8ce',  -- Delete (Nov 22 15:17:03)
  'c9cac60d-ace3-47f0-a118-d3b873643c98',  -- Delete (Nov 22 15:16:28)
  
  -- "test" duplicates
  'dd1c674a-fcea-4e33-b212-26d34efae2c4',  -- Keep (Nov 16 18:41:54)
  'bbcb1ae7-3c33-4226-86f9-6ab0b859af70',  -- Delete (Nov 16 18:39:01)
  '2eb6ad7f-b51d-4c4c-bba7-2a262db6fdd8',  -- Delete (Nov 16 18:38:50)
  '9baf4aa6-1da7-49c1-8bf4-e370e82cffcb',  -- Delete (Nov 16 18:38:04)
  '80f5177a-0740-4508-b66a-7894209bff49'   -- Delete (Nov 16 18:15:49)
)
ORDER BY title, created_at DESC;

-- ============================================================
-- STEP 2: DELETE DUPLICATES (UNCOMMENT TO EXECUTE)
-- ============================================================
-- This will delete 5 older duplicate events
-- Keeping the 2 most recent ones
-- ============================================================

/*
DELETE FROM events.events
WHERE id IN (
  -- "Liventix Official Event!" - delete 2 older duplicates
  '0f8a9095-d1da-4ba0-b8b0-0de14c28c8ce',  -- Nov 22 15:17:03
  'c9cac60d-ace3-47f0-a118-d3b873643c98',  -- Nov 22 15:16:28
  
  -- "test" - delete 4 older duplicates
  'bbcb1ae7-3c33-4226-86f9-6ab0b859af70',  -- Nov 16 18:39:01
  '2eb6ad7f-b51d-4c4c-bba7-2a262db6fdd8',  -- Nov 16 18:38:50
  '9baf4aa6-1da7-49c1-8bf4-e370e82cffcb',  -- Nov 16 18:38:04
  '80f5177a-0740-4508-b66a-7894209bff49'   -- Nov 16 18:15:49
);
*/

-- STEP 3: Verify deletion (should return 0)
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

