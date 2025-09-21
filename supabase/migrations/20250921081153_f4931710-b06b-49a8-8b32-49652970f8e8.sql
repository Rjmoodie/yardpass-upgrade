-- Fix comment counts to match actual comments
UPDATE event_posts 
SET comment_count = (
  SELECT COUNT(*) 
  FROM event_comments 
  WHERE event_comments.post_id = event_posts.id
);

-- Create function to update comment count
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE event_posts 
    SET comment_count = (
      SELECT COUNT(*) 
      FROM event_comments 
      WHERE post_id = NEW.post_id
    )
    WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    UPDATE event_posts 
    SET comment_count = (
      SELECT COUNT(*) 
      FROM event_comments 
      WHERE post_id = OLD.post_id
    )
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically maintain comment counts
DROP TRIGGER IF EXISTS trigger_update_comment_count_on_insert ON event_comments;
DROP TRIGGER IF EXISTS trigger_update_comment_count_on_delete ON event_comments;

CREATE TRIGGER trigger_update_comment_count_on_insert
    AFTER INSERT ON event_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_post_comment_count();

CREATE TRIGGER trigger_update_comment_count_on_delete
    AFTER DELETE ON event_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_post_comment_count();