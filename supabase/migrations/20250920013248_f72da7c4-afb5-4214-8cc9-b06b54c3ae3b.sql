-- Fix the count again and investigate trigger issues
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

-- Drop all existing comment-related triggers to avoid duplicates
DROP TRIGGER IF EXISTS comment_count_trigger ON event_comments;
DROP TRIGGER IF EXISTS _bump_comment_count_trigger ON event_comments;
DROP TRIGGER IF EXISTS inc_comment_count_trigger ON event_comments;

-- Drop old functions
DROP FUNCTION IF EXISTS update_post_comment_count();
DROP FUNCTION IF EXISTS _bump_comment_count();
DROP FUNCTION IF EXISTS inc_comment_count();

-- Create a single, clean comment count trigger
CREATE OR REPLACE FUNCTION handle_comment_count_change()
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Create the trigger with a unique name
CREATE TRIGGER handle_comment_count_trigger
  AFTER INSERT OR DELETE ON event_comments
  FOR EACH ROW
  EXECUTE FUNCTION handle_comment_count_change();