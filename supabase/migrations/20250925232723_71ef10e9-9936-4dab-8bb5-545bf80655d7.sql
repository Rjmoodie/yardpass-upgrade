-- Fix the function to have proper search path and replace existing trigger
CREATE OR REPLACE FUNCTION public.handle_comment_count_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE event_posts SET comment_count = COALESCE(comment_count,0) + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE event_posts SET comment_count = GREATEST(COALESCE(comment_count,0) - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;