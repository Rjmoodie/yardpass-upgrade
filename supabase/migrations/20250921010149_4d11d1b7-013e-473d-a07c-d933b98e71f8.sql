-- Fix comment counts to match actual comment records
UPDATE event_posts 
SET comment_count = (
  SELECT COUNT(*) 
  FROM event_comments ec 
  WHERE ec.post_id = event_posts.id
)
WHERE deleted_at IS NULL;