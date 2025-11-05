-- Fix reaction trigger functions to use SECURITY DEFINER
-- Same issue as comment triggers - they need to bypass RLS

-- Fix learn_tags_from_post_like
CREATE OR REPLACE FUNCTION public.learn_tags_from_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
BEGIN
  -- Find the parent event for this post (use public.event_posts view)
  SELECT p.event_id INTO v_event_id
  FROM event_posts p
  WHERE p.id = NEW.post_id;

  IF v_event_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Weight: +0.3 for likes
  PERFORM public.update_user_tag_preferences(
    NEW.user_id,
    v_event_id,
    0.3
  );

  RETURN NEW;
END;
$function$;

-- Fix public.update_post_like_count if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_post_like_count'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    CREATE OR REPLACE FUNCTION public.update_post_like_count()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $func$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        UPDATE event_posts 
        SET like_count = (
          SELECT COUNT(*) 
          FROM event_reactions 
          WHERE post_id = NEW.post_id
            AND kind = 'like'
        )
        WHERE id = NEW.post_id;
        RETURN NEW;
      END IF;
      
      IF TG_OP = 'DELETE' THEN
        UPDATE event_posts 
        SET like_count = (
          SELECT COUNT(*) 
          FROM event_reactions 
          WHERE post_id = OLD.post_id
            AND kind = 'like'
        )
        WHERE id = OLD.post_id;
        RETURN OLD;
      END IF;
      
      RETURN NULL;
    END;
    $func$;
  END IF;
END $$;

COMMENT ON FUNCTION public.learn_tags_from_post_like IS
'Fixed to use SECURITY DEFINER and public schema views to prevent 500 errors on reaction insert';





