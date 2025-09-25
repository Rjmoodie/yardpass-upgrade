-- Fix and ensure proper comment count triggers with security
CREATE OR REPLACE FUNCTION public.handle_comment_count_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.event_posts
      SET comment_count = COALESCE(comment_count,0) + 1
      WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.event_posts
      SET comment_count = GREATEST(COALESCE(comment_count,0) - 1, 0)
      WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Recreate triggers to ensure they exist
DROP TRIGGER IF EXISTS trg_comment_count_ins ON public.event_comments;
CREATE TRIGGER trg_comment_count_ins
AFTER INSERT ON public.event_comments
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_count_change();

DROP TRIGGER IF EXISTS trg_comment_count_del ON public.event_comments;
CREATE TRIGGER trg_comment_count_del
AFTER DELETE ON public.event_comments
FOR EACH ROW EXECUTE FUNCTION public.handle_comment_count_change();

-- Helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_comments_post_id ON public.event_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_event_comments_created_at ON public.event_comments(created_at);