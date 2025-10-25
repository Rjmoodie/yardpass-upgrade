-- ✅ Backfill all existing like_count and comment_count
-- This will count all existing likes and comments and update the posts table

UPDATE events.event_posts p
SET 
  like_count = COALESCE((
    SELECT COUNT(*)
    FROM events.event_reactions r
    WHERE r.post_id = p.id 
      AND r.kind = 'like'
  ), 0),
  comment_count = COALESCE((
    SELECT COUNT(*)
    FROM events.event_comments c
    WHERE c.post_id = p.id
  ), 0)
WHERE p.deleted_at IS NULL;

-- ✅ Verify the counts are now correct
SELECT 
  id,
  LEFT(text, 50) as text_preview,
  like_count,
  comment_count,
  (SELECT COUNT(*) FROM events.event_reactions WHERE post_id = p.id AND kind = 'like') as actual_likes,
  (SELECT COUNT(*) FROM events.event_comments WHERE post_id = p.id) as actual_comments,
  created_at
FROM events.event_posts p
WHERE p.deleted_at IS NULL
ORDER BY p.created_at DESC
LIMIT 20;

