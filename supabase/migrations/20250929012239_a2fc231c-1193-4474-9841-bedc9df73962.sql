-- 1) One like per (post,user) - prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS event_reactions_like_unique
ON public.event_reactions (post_id, user_id)
WHERE kind = 'like';

-- 2) Ensure users can delete their own likes (this policy should already exist but let's make sure)
DROP POLICY IF EXISTS event_reactions_delete_self ON public.event_reactions;
CREATE POLICY event_reactions_delete_self
ON public.event_reactions
FOR DELETE
USING (user_id = auth.uid());

-- 3) Add trigger to automatically update like_count on event_posts
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.kind = 'like' THEN
    UPDATE public.event_posts 
    SET like_count = like_count + 1 
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.kind = 'like' THEN
    UPDATE public.event_posts 
    SET like_count = GREATEST(like_count - 1, 0) 
    WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_update_post_like_count ON public.event_reactions;
CREATE TRIGGER trigger_update_post_like_count
  AFTER INSERT OR DELETE ON public.event_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_post_like_count();