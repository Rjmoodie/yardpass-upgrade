-- Drop duplicate event_reactions trigger functions from events schema
-- We only need the public schema versions with SECURITY DEFINER

-- Drop the events schema version of update_post_like_count
DROP FUNCTION IF EXISTS events.update_post_like_count() CASCADE;

-- Recreate the trigger using the public schema function
DROP TRIGGER IF EXISTS trigger_update_post_like_count ON events.event_reactions;

CREATE TRIGGER trigger_update_post_like_count
  AFTER INSERT OR DELETE ON events.event_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_like_count();

COMMENT ON TRIGGER trigger_update_post_like_count ON events.event_reactions IS
'Uses public.update_post_like_count with SECURITY DEFINER to prevent RLS recursion';





