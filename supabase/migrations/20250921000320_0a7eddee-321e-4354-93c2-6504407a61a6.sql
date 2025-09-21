-- Fix comment count synchronization
-- Create trigger function to update comment count
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

-- Create triggers for comment count updates
DROP TRIGGER IF EXISTS update_comment_count_on_insert ON event_comments;
DROP TRIGGER IF EXISTS update_comment_count_on_delete ON event_comments;

CREATE TRIGGER update_comment_count_on_insert
  AFTER INSERT ON event_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_comment_count();

CREATE TRIGGER update_comment_count_on_delete
  AFTER DELETE ON event_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_comment_count();

-- Fix existing comment counts by recalculating them
UPDATE event_posts 
SET comment_count = (
  SELECT COUNT(*)
  FROM event_comments ec
  WHERE ec.post_id = event_posts.id
);