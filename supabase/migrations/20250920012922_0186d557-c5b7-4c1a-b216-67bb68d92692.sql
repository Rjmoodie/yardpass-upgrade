-- Fix comment count discrepancies by updating the stored counts to match actual counts
UPDATE event_posts 
SET comment_count = (
  SELECT COUNT(*) 
  FROM event_comments 
  WHERE post_id = event_posts.id
)
WHERE comment_count != (
  SELECT COUNT(*) 
  FROM event_comments 
  WHERE post_id = event_posts.id
);

-- Ensure the comment count trigger is working properly by recreating it
DROP TRIGGER IF EXISTS comment_count_trigger ON event_comments;

CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE event_posts 
    SET comment_count = comment_count + 1 
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE event_posts 
    SET comment_count = GREATEST(comment_count - 1, 0) 
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER comment_count_trigger
  AFTER INSERT OR DELETE ON event_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_comment_count();