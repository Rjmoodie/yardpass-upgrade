-- 1) Unique index to prevent duplicate likes per user per post
CREATE UNIQUE INDEX IF NOT EXISTS event_reactions_like_unique
ON public.event_reactions (post_id, user_id)
WHERE kind = 'like';

-- 2) Function to recompute like_count from actual table data
CREATE OR REPLACE FUNCTION public.sync_post_like_count(p_post uuid)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.event_posts
  SET like_count = (
    SELECT COUNT(*) FROM public.event_reactions
    WHERE post_id = p_post AND kind = 'like'
  )
  WHERE id = p_post;
$$;

-- 3) Trigger function to sync counts on like changes
CREATE OR REPLACE FUNCTION public.handle_like_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_post_like_count(COALESCE(NEW.post_id, OLD.post_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) Remove old triggers and create new ones
DROP TRIGGER IF EXISTS trg_like_sync_ins ON public.event_reactions;
CREATE TRIGGER trg_like_sync_ins
AFTER INSERT ON public.event_reactions
FOR EACH ROW EXECUTE FUNCTION public.handle_like_sync();

DROP TRIGGER IF EXISTS trg_like_sync_del ON public.event_reactions;
CREATE TRIGGER trg_like_sync_del
AFTER DELETE ON public.event_reactions
FOR EACH ROW EXECUTE FUNCTION public.handle_like_sync();

-- Remove the old bump trigger to avoid conflicts
DROP TRIGGER IF EXISTS event_reactions_bump_like_count ON public.event_reactions;