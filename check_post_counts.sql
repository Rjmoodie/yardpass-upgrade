-- Check if event_posts have correct counts
SELECT 
  p.id,
  LEFT(p.text, 30) as post_text,
  p.like_count as stored_likes,
  p.comment_count as stored_comments,
  (SELECT COUNT(*) FROM events.event_reactions WHERE post_id = p.id AND kind = 'like') as actual_likes,
  (SELECT COUNT(*) FROM events.event_comments WHERE post_id = p.id) as actual_comments,
  p.created_at
FROM events.event_posts p
WHERE p.deleted_at IS NULL
ORDER BY p.created_at DESC
LIMIT 20;

-- Quick summary
SELECT 
  COUNT(*) as total_posts,
  SUM(like_count) as total_stored_likes,
  SUM(comment_count) as total_stored_comments,
  (SELECT COUNT(*) FROM events.event_reactions WHERE kind = 'like') as total_actual_likes,
  (SELECT COUNT(*) FROM events.event_comments) as total_actual_comments
FROM events.event_posts
WHERE deleted_at IS NULL;

