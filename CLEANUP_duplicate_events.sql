-- Clean up duplicate "Ultimate Soccer Tailgate Experience" events
-- Keep the most recent one, delete the older duplicates

-- First, verify which one to keep (the newest one)
SELECT 
  id,
  title,
  created_at,
  CASE 
    WHEN id = '45691a09-f1a9-4ab1-9e2f-e4e40e692960' THEN '✓ KEEP (newest)'
    ELSE '✗ DELETE (duplicate)'
  END as action
FROM events.events
WHERE title = 'Ultimate Soccer Tailgate Experience'
  AND created_at > '2025-11-07 13:00:00'
ORDER BY created_at DESC;

-- Delete the 3 older duplicates
DELETE FROM events.events
WHERE id IN (
  'd31ccb95-1e38-47c0-966e-c58bece0f36c',
  '0cb8cd28-b725-413a-a651-a111dfd51063',
  '4b35c2ea-b45a-474b-892d-28e86ce47478'
);

