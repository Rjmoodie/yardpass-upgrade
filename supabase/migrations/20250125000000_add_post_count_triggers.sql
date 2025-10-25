-- Add triggers to automatically update like_count and comment_count in event_posts
-- This ensures counts stay in sync when reactions/comments are added/removed

-- Function to update like count
CREATE OR REPLACE FUNCTION events.update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.kind = 'like' THEN
    UPDATE events.event_posts
    SET like_count = COALESCE(like_count, 0) + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.kind = 'like' THEN
    UPDATE events.event_posts
    SET like_count = GREATEST(COALESCE(like_count, 0) - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update comment count
CREATE OR REPLACE FUNCTION events.update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events.event_posts
    SET comment_count = COALESCE(comment_count, 0) + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events.event_posts
    SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_post_like_count ON events.event_reactions;
DROP TRIGGER IF EXISTS trigger_update_post_comment_count ON events.event_comments;

-- Create trigger for likes
CREATE TRIGGER trigger_update_post_like_count
AFTER INSERT OR DELETE ON events.event_reactions
FOR EACH ROW
EXECUTE FUNCTION events.update_post_like_count();

-- Create trigger for comments
CREATE TRIGGER trigger_update_post_comment_count
AFTER INSERT OR DELETE ON events.event_comments
FOR EACH ROW
EXECUTE FUNCTION events.update_post_comment_count();

-- Backfill existing counts (run once to sync current state)
UPDATE events.event_posts p
SET 
  like_count = (
    SELECT COUNT(*)
    FROM events.event_reactions r
    WHERE r.post_id = p.id AND r.kind = 'like'
  ),
  comment_count = (
    SELECT COUNT(*)
    FROM events.event_comments c
    WHERE c.post_id = p.id AND c.deleted_at IS NULL
  );

COMMENT ON FUNCTION events.update_post_like_count() IS 'Automatically updates like_count when reactions are added/removed';
COMMENT ON FUNCTION events.update_post_comment_count() IS 'Automatically updates comment_count when comments are added/removed';

