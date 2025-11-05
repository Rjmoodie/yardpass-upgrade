-- Fix learn_tags_from_post_comment to use SECURITY DEFINER
-- This was the last trigger causing 500 errors on comment insert

CREATE OR REPLACE FUNCTION public.learn_tags_from_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
BEGIN
  -- Find the parent event for this post
  SELECT p.event_id INTO v_event_id
  FROM event_posts p
  WHERE p.id = NEW.post_id;

  IF v_event_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Weight: +0.4 for comments (stronger signal than likes)
  PERFORM public.update_user_tag_preferences(
    NEW.author_user_id,
    v_event_id,
    0.4
  );

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.learn_tags_from_post_comment IS
'Fixed to use SECURITY DEFINER and public schema views to prevent 500 errors on comment insert';





