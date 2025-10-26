-- Create a public view for user_saved_posts to make it accessible from the public schema
-- This allows frontend code to query from 'user_saved_posts' without specifying schema

CREATE OR REPLACE VIEW public.user_saved_posts AS
SELECT 
  id,
  user_id,
  post_id,
  event_id,
  created_at
FROM events.user_saved_posts;

-- Grant permissions on the view
GRANT SELECT, INSERT, DELETE ON public.user_saved_posts TO authenticated;
GRANT SELECT ON public.user_saved_posts TO anon;

-- Create INSTEAD OF triggers to allow INSERT/DELETE operations through the view
CREATE OR REPLACE FUNCTION public.user_saved_posts_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO events.user_saved_posts (user_id, post_id, event_id)
  VALUES (NEW.user_id, NEW.post_id, NEW.event_id)
  RETURNING * INTO NEW;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.user_saved_posts_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM events.user_saved_posts
  WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS user_saved_posts_insert_trigger ON public.user_saved_posts;
DROP TRIGGER IF EXISTS user_saved_posts_delete_trigger ON public.user_saved_posts;

-- Create triggers
CREATE TRIGGER user_saved_posts_insert_trigger
  INSTEAD OF INSERT ON public.user_saved_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.user_saved_posts_insert();

CREATE TRIGGER user_saved_posts_delete_trigger
  INSTEAD OF DELETE ON public.user_saved_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.user_saved_posts_delete();

-- Add helpful comment
COMMENT ON VIEW public.user_saved_posts IS 'Public view of events.user_saved_posts for easier frontend access';

