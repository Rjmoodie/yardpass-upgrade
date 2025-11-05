-- Fix comment count trigger functions to use correct schema qualification
-- This was causing 500 errors when posting comments

-- Fix update_post_comment_count - add SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.update_post_comment_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE event_posts 
    SET comment_count = (
      SELECT COUNT(*) 
      FROM event_comments 
      WHERE post_id = NEW.post_id
        AND deleted_at IS NULL
    )
    WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    UPDATE event_posts 
    SET comment_count = (
      SELECT COUNT(*) 
      FROM event_comments 
      WHERE post_id = OLD.post_id
        AND deleted_at IS NULL
    )
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$function$;

-- Check if handle_comment_count_change exists and fix it too
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_comment_count_change'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    -- Fix handle_comment_count_change
    CREATE OR REPLACE FUNCTION public.handle_comment_count_change()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $func$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        UPDATE event_posts 
        SET comment_count = COALESCE(comment_count, 0) + 1
        WHERE id = NEW.post_id;
        RETURN NEW;
      ELSIF TG_OP = 'DELETE' THEN
        UPDATE event_posts 
        SET comment_count = GREATEST(0, COALESCE(comment_count, 0) - 1)
        WHERE id = OLD.post_id;
        RETURN OLD;
      END IF;
      RETURN NULL;
    END;
    $func$;
  END IF;
END $$;

-- Check if trg_event_comments_bump_counts exists and fix it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'trg_event_comments_bump_counts'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    -- Fix trg_event_comments_bump_counts
    CREATE OR REPLACE FUNCTION public.trg_event_comments_bump_counts()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $func$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        UPDATE event_posts 
        SET comment_count = (
          SELECT COUNT(*) 
          FROM event_comments 
          WHERE post_id = NEW.post_id
            AND deleted_at IS NULL
        )
        WHERE id = NEW.post_id;
        RETURN NEW;
      ELSIF TG_OP = 'DELETE' THEN
        UPDATE event_posts 
        SET comment_count = (
          SELECT COUNT(*) 
          FROM event_comments 
          WHERE post_id = OLD.post_id
            AND deleted_at IS NULL
        )
        WHERE id = OLD.post_id;
        RETURN OLD;
      END IF;
      RETURN NULL;
    END;
    $func$;
  END IF;
END $$;

-- Check if bump_reply_count exists and fix it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'bump_reply_count'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    -- Fix bump_reply_count
    CREATE OR REPLACE FUNCTION public.bump_reply_count()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path TO 'public'
    AS $func$
    BEGIN
      IF NEW.parent_comment_id IS NOT NULL THEN
        UPDATE event_comments
        SET reply_count = COALESCE(reply_count, 0) + 1
        WHERE id = NEW.parent_comment_id;
      END IF;
      RETURN NEW;
    END;
    $func$;
  END IF;
END $$;

COMMENT ON FUNCTION public.update_post_comment_count IS
'Fixed to use events schema qualification and SECURITY DEFINER to prevent 500 errors';

