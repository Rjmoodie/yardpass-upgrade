-- 006_triggers_counters.sql
BEGIN;

-- comments -> reply_count
CREATE OR REPLACE FUNCTION public.bump_reply_count()
RETURNS trigger AS $$
BEGIN
  UPDATE public.event_posts
  SET reply_count = reply_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comment_insert ON public.event_comments;
CREATE TRIGGER trg_comment_insert
AFTER INSERT ON public.event_comments
FOR EACH ROW EXECUTE FUNCTION public.bump_reply_count();

-- reactions (like) -> like_count up; also handle delete
CREATE OR REPLACE FUNCTION public.bump_like_count()
RETURNS trigger AS $$
BEGIN
  IF NEW.kind = 'like' THEN
    UPDATE public.event_posts
    SET like_count = like_count + 1
    WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.decr_like_count()
RETURNS trigger AS $$
BEGIN
  IF OLD.kind = 'like' THEN
    UPDATE public.event_posts
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  RETURN OLD;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reaction_insert ON public.event_reactions;
CREATE TRIGGER trg_reaction_insert
AFTER INSERT ON public.event_reactions
FOR EACH ROW EXECUTE FUNCTION public.bump_like_count();

DROP TRIGGER IF EXISTS trg_reaction_delete ON public.event_reactions;
CREATE TRIGGER trg_reaction_delete
AFTER DELETE ON public.event_reactions
FOR EACH ROW EXECUTE FUNCTION public.decr_like_count();

COMMIT;
