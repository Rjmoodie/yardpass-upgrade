-- 2) Exact counters for likes & comments (no drift)

-- 2.1 Comments → post.comment_count
CREATE OR REPLACE FUNCTION public._bump_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.event_posts
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.event_posts
    SET comment_count = GREATEST(comment_count - 1, 0)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_comments_count_ins ON public.event_comments;
CREATE TRIGGER trg_event_comments_count_ins
AFTER INSERT ON public.event_comments
FOR EACH ROW EXECUTE FUNCTION public._bump_comment_count();

DROP TRIGGER IF EXISTS trg_event_comments_count_del ON public.event_comments;
CREATE TRIGGER trg_event_comments_count_del
AFTER DELETE ON public.event_comments
FOR EACH ROW EXECUTE FUNCTION public._bump_comment_count();

-- 2.2 Reactions(kind='like') → post.like_count
CREATE OR REPLACE FUNCTION public._bump_like_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.kind = 'like' THEN
      UPDATE public.event_posts
      SET like_count = like_count + 1
      WHERE id = NEW.post_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.kind = 'like' THEN
      UPDATE public.event_posts
      SET like_count = GREATEST(like_count - 1, 0)
      WHERE id = OLD.post_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_reactions_like_ins ON public.event_reactions;
CREATE TRIGGER trg_event_reactions_like_ins
AFTER INSERT ON public.event_reactions
FOR EACH ROW EXECUTE FUNCTION public._bump_like_count();

DROP TRIGGER IF EXISTS trg_event_reactions_like_del ON public.event_reactions;
CREATE TRIGGER trg_event_reactions_like_del
AFTER DELETE ON public.event_reactions
FOR EACH ROW EXECUTE FUNCTION public._bump_like_count();

-- 3) RLS policies that match your rules

-- Ensure RLS is ON
ALTER TABLE public.event_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "posts_read_public_or_access" ON public.event_posts;
DROP POLICY IF EXISTS "posts_read_public" ON public.event_posts;
DROP POLICY IF EXISTS "posts_insert_authorized" ON public.event_posts;
DROP POLICY IF EXISTS "posts_modify_owner_or_org" ON public.event_posts;
DROP POLICY IF EXISTS "posts_delete_owner_or_org" ON public.event_posts;

DROP POLICY IF EXISTS "comments_read_public_or_access" ON public.event_comments;
DROP POLICY IF EXISTS "comments_insert_access" ON public.event_comments;
DROP POLICY IF EXISTS "comments_update_author_or_manager" ON public.event_comments;
DROP POLICY IF EXISTS "comments_delete_author_or_manager" ON public.event_comments;