-- Fix likes system: unique constraints, RLS policies, and exact count triggers

-- 1) Unique index to prevent duplicate likes
CREATE UNIQUE INDEX IF NOT EXISTS event_reactions_like_unique
ON public.event_reactions (post_id, user_id)
WHERE kind = 'like';

-- 2) Drop existing policies and create new ones
DROP POLICY IF EXISTS event_reactions_select_all ON public.event_reactions;
DROP POLICY IF EXISTS event_reactions_insert_self ON public.event_reactions;
DROP POLICY IF EXISTS event_reactions_delete_self ON public.event_reactions;

-- SELECT: anyone can read likes
CREATE POLICY event_reactions_select_all
ON public.event_reactions
FOR SELECT USING (true);

-- INSERT: user can insert their own like
CREATE POLICY event_reactions_insert_self
ON public.event_reactions
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- DELETE: user can remove their own like (this fixes "cannot remove like")
CREATE POLICY event_reactions_delete_self
ON public.event_reactions
FOR DELETE USING (user_id = auth.uid());

-- 3) Exact count synchronization functions and triggers
CREATE OR REPLACE FUNCTION public.sync_post_like_count(p_post uuid)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.event_posts
  SET like_count = (
    SELECT COUNT(*)
    FROM public.event_reactions
    WHERE post_id = p_post AND kind = 'like'
  )
  WHERE id = p_post;
$$;

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

-- Drop and recreate triggers
DROP TRIGGER IF EXISTS trg_like_sync_ins ON public.event_reactions;
CREATE TRIGGER trg_like_sync_ins
AFTER INSERT ON public.event_reactions
FOR EACH ROW EXECUTE FUNCTION public.handle_like_sync();

DROP TRIGGER IF EXISTS trg_like_sync_del ON public.event_reactions;
CREATE TRIGGER trg_like_sync_del
AFTER DELETE ON public.event_reactions
FOR EACH ROW EXECUTE FUNCTION public.handle_like_sync();