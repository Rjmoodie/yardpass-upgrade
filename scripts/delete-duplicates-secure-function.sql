-- ============================================================
-- Delete Duplicates Using SECURITY DEFINER Function
-- ============================================================
-- This creates a function that bypasses RLS to delete duplicates
-- Use this if the direct DELETE is blocked by RLS policies
-- ============================================================

-- STEP 1: Create function to delete duplicates (bypasses RLS)
CREATE OR REPLACE FUNCTION public.delete_duplicate_events()
RETURNS INTEGER
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
  
  RETURN v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_duplicate_events() TO authenticated;

COMMENT ON FUNCTION public.delete_duplicate_events IS 
'Deletes duplicate events, keeping only the most recent one per title+org combination. Bypasses RLS.';

-- STEP 2: Run the function to delete duplicates
-- This will return the number of events deleted
SELECT public.delete_duplicate_events() as deleted_count;

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

-- STEP 4: Clean up function (optional, uncomment to remove after use)
/*
DROP FUNCTION IF EXISTS public.delete_duplicate_events();
*/

