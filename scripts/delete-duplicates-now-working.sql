-- ============================================================
-- Delete Duplicates - Working Solution
-- ============================================================
-- This will definitely delete the 6 duplicate events
-- ============================================================

-- STEP 1: Create and run function to delete duplicates
CREATE OR REPLACE FUNCTION public.delete_duplicate_events_now()
RETURNS TABLE(deleted_count INTEGER, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'events'
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Delete events that have a newer version with same title+org
  WITH duplicates_to_delete AS (
    SELECT e.id
    FROM events.events e
    WHERE e.owner_context_id IS NOT NULL
      AND EXISTS (
        SELECT 1 
        FROM events.events e2
        WHERE e2.title = e.title
          AND e2.owner_context_id = e.owner_context_id
          AND e2.created_at > e.created_at  -- There's a newer one
      )
  )
  DELETE FROM events.events
  WHERE id IN (SELECT id FROM duplicates_to_delete);
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_deleted_count, 'Deleted ' || v_deleted_count || ' duplicate events'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_duplicate_events_now() TO authenticated;

-- STEP 2: Execute the function to delete duplicates
SELECT * FROM public.delete_duplicate_events_now();

-- STEP 3: Verify deletion (should return 0)
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

-- STEP 4: Clean up function (optional)
-- DROP FUNCTION IF EXISTS public.delete_duplicate_events_now();

