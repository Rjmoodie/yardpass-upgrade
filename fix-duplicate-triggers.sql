-- ==========================================
-- FIX DUPLICATE TRIGGERS ON event_reactions
-- ==========================================
-- Problem: 6 triggers are firing (should be only 2)
-- This causes like counts to be tripled
-- ==========================================

BEGIN;

-- ==========================================
-- STEP 1: Drop duplicate triggers (keep only _bump_like_count)
-- ==========================================

-- Drop trg_reaction_insert/delete (duplicate #1)
DROP TRIGGER IF EXISTS trg_reaction_insert ON events.event_reactions;
DROP TRIGGER IF EXISTS trg_reaction_delete ON events.event_reactions;

-- Drop event_reactions_bump_counts (duplicate #2)
DROP TRIGGER IF EXISTS event_reactions_bump_counts ON events.event_reactions;

-- Keep: trg_event_reactions_like_ins and trg_event_reactions_like_del
-- These use the _bump_like_count() function which is the cleanest implementation

-- ==========================================
-- STEP 2: Do the same for event_comments
-- ==========================================

-- Check current comment triggers
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'event_comments'
AND event_object_schema = 'events'
ORDER BY trigger_name;

-- Drop duplicates (we'll verify which ones to keep based on the query above)
DROP TRIGGER IF EXISTS event_comments_bump_counts ON events.event_comments;
DROP TRIGGER IF EXISTS trg_comment_insert ON events.event_comments;

-- Keep: handle_comment_count_trigger and trg_comment_count_ins/del

-- ==========================================
-- STEP 3: Recalculate ALL counts from actual data
-- ==========================================

UPDATE public.event_posts p
SET 
  like_count = COALESCE((
    SELECT COUNT(*) 
    FROM public.event_reactions r 
    WHERE r.post_id = p.id AND r.kind = 'like'
  ), 0),
  comment_count = COALESCE((
    SELECT COUNT(*) 
    FROM public.event_comments c 
    WHERE c.post_id = p.id
  ), 0)
WHERE p.deleted_at IS NULL;

-- ==========================================
-- STEP 4: Verify the fix worked
-- ==========================================

-- Check for any remaining mismatches
SELECT 
  p.id as post_id,
  p.text,
  p.like_count as cached_likes,
  COUNT(DISTINCT r.user_id) FILTER (WHERE r.kind = 'like') as actual_likes,
  p.comment_count as cached_comments,
  COUNT(DISTINCT c.id) as actual_comments,
  p.like_count - COUNT(DISTINCT r.user_id) FILTER (WHERE r.kind = 'like') as like_diff,
  p.comment_count - COUNT(DISTINCT c.id) as comment_diff
FROM public.event_posts p
LEFT JOIN public.event_reactions r ON r.post_id = p.id
LEFT JOIN public.event_comments c ON c.post_id = p.id
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.text, p.like_count, p.comment_count
HAVING 
  p.like_count != COUNT(DISTINCT r.user_id) FILTER (WHERE r.kind = 'like')
  OR p.comment_count != COUNT(DISTINCT c.id)
ORDER BY p.created_at DESC
LIMIT 10;

-- If this returns no rows, the fix worked!

-- ==========================================
-- STEP 5: Verify triggers are now correct
-- ==========================================

SELECT 
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('event_reactions', 'event_comments')
AND event_object_schema = 'events'
ORDER BY event_object_table, trigger_name;

-- Should see only 2 triggers per table now

COMMIT;

-- ==========================================
-- ROLLBACK COMMAND (if something goes wrong)
-- ==========================================
-- If you need to undo, run: ROLLBACK;

