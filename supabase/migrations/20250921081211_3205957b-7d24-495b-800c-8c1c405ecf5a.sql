-- Fix the search path for the comment count function to make it secure
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
$$ LANGUAGE plpgsql 
SET search_path = public;