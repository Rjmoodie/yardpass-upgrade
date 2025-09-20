-- First, drop all triggers that use the functions
DROP TRIGGER IF EXISTS comment_count_trigger ON event_comments;
DROP TRIGGER IF EXISTS event_comments_bump_comment_count ON event_comments;
DROP TRIGGER IF EXISTS trg_comment_del ON event_comments;
DROP TRIGGER IF EXISTS trg_comment_ins ON event_comments;
DROP TRIGGER IF EXISTS trg_event_comments_count_del ON event_comments;
DROP TRIGGER IF EXISTS trg_event_comments_count_ins ON event_comments;

-- Now drop the functions (should work since triggers are gone)
DROP FUNCTION IF EXISTS update_post_comment_count() CASCADE;
DROP FUNCTION IF EXISTS _bump_comment_count() CASCADE;
DROP FUNCTION IF EXISTS inc_comment_count() CASCADE;

-- Fix the counts to match reality
UPDATE event_posts 
SET comment_count = (
  SELECT COUNT(*) 
  FROM event_comments 
  WHERE post_id = event_posts.id
);

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

-- Create the single trigger
CREATE TRIGGER handle_comment_count_trigger
  AFTER INSERT OR DELETE ON event_comments
  FOR EACH ROW
  EXECUTE FUNCTION handle_comment_count_change();