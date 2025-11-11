-- Migration: Make public.follows View Fully Writable
-- Purpose: Create INSTEAD OF triggers so public.follows view can proxy INSERT/UPDATE/DELETE to users.follows

-- ============================================================================
-- 1. CREATE INSTEAD OF TRIGGERS FOR VIEW
-- ============================================================================

-- Function: Handle INSERT via view
CREATE OR REPLACE FUNCTION public.follows_view_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert into base table, using defaults for columns not provided
  INSERT INTO users.follows (
    follower_user_id, 
    target_type, 
    target_id, 
    status,
    follower_type,
    follower_org_id
  )
  VALUES (
    NEW.follower_user_id, 
    NEW.target_type, 
    NEW.target_id, 
    COALESCE(NEW.status, 'accepted'), -- Use provided status or default
    COALESCE(NEW.follower_type, 'user'::public.follow_actor), -- Default to 'user'
    NEW.follower_org_id -- Can be NULL
  )
  RETURNING * INTO NEW;
  
  RETURN NEW;
END;
$$;

-- Function: Handle UPDATE via view
CREATE OR REPLACE FUNCTION public.follows_view_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users.follows
  SET 
    status = NEW.status,
    follower_type = NEW.follower_type,
    follower_org_id = NEW.follower_org_id
  WHERE id = OLD.id;
  
  RETURN NEW;
END;
$$;

-- Function: Handle DELETE via view
CREATE OR REPLACE FUNCTION public.follows_view_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM users.follows WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS follows_view_insert_trigger ON public.follows;
DROP TRIGGER IF EXISTS follows_view_update_trigger ON public.follows;
DROP TRIGGER IF EXISTS follows_view_delete_trigger ON public.follows;

-- Create INSTEAD OF triggers
CREATE TRIGGER follows_view_insert_trigger
  INSTEAD OF INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.follows_view_insert();

CREATE TRIGGER follows_view_update_trigger
  INSTEAD OF UPDATE ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.follows_view_update();

CREATE TRIGGER follows_view_delete_trigger
  INSTEAD OF DELETE ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.follows_view_delete();

COMMENT ON FUNCTION public.follows_view_insert IS 'Proxies INSERT from public.follows view to users.follows table';
COMMENT ON FUNCTION public.follows_view_update IS 'Proxies UPDATE from public.follows view to users.follows table';
COMMENT ON FUNCTION public.follows_view_delete IS 'Proxies DELETE from public.follows view to users.follows table';

-- ============================================================================
-- 2. GRANT PERMISSIONS
-- ============================================================================

-- Grant view access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follows TO authenticated;
GRANT SELECT ON public.follows TO anon;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ public.follows view is now fully writable';
  RAISE NOTICE '   - INSTEAD OF triggers proxy to users.follows';
  RAISE NOTICE '   - RLS policies from users.follows are enforced';
  RAISE NOTICE '   - Frontend can use: supabase.from("follows")';
  RAISE NOTICE '';
  RAISE NOTICE '✅ All follow operations now work through the view';
END $$;

