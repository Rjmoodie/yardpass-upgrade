-- Fix RLS permission denied for user_saved_posts view
-- The SECURITY DEFINER trigger needs to properly bypass RLS

-- Update the INSERT trigger with better permissions handling
CREATE OR REPLACE FUNCTION public.user_saved_posts_insert()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, events
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id UUID;
  v_user_id UUID;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  
  -- Security check: user can only save for themselves
  IF v_user_id IS NULL OR NEW.user_id != v_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Auto-populate event_id from the post if not provided
  IF NEW.event_id IS NULL AND NEW.post_id IS NOT NULL THEN
    SELECT event_id INTO v_event_id
    FROM events.event_posts
    WHERE id = NEW.post_id;
    
    NEW.event_id := v_event_id;
  END IF;
  
  -- Insert with SECURITY DEFINER bypassing RLS
  INSERT INTO events.user_saved_posts (user_id, post_id, event_id)
  VALUES (NEW.user_id, NEW.post_id, NEW.event_id)
  ON CONFLICT (user_id, post_id) DO NOTHING
  RETURNING * INTO NEW;
  
  RETURN NEW;
END;
$$;

-- Update the DELETE trigger with better permissions handling
CREATE OR REPLACE FUNCTION public.user_saved_posts_delete()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, events
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  
  -- Security check: user can only delete their own saves
  IF v_user_id IS NULL OR OLD.user_id != v_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  
  -- Delete with SECURITY DEFINER bypassing RLS
  DELETE FROM events.user_saved_posts
  WHERE id = OLD.id
    AND user_id = v_user_id;  -- Extra safety check
  
  RETURN OLD;
END;
$$;

-- Ensure the underlying table grants are correct
GRANT SELECT, INSERT, DELETE ON events.user_saved_posts TO authenticated;

-- Grant USAGE on the schema (might be missing)
GRANT USAGE ON SCHEMA events TO authenticated;

-- Verify view permissions are still correct
GRANT SELECT, INSERT, DELETE ON public.user_saved_posts TO authenticated;
GRANT SELECT ON public.user_saved_posts TO anon;

-- Success message
SELECT 
  '✅ RLS bypass fixed for user_saved_posts' AS status,
  'SECURITY DEFINER functions now properly bypass RLS' AS note;







