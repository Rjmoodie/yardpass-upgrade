-- Create the missing trigger on auth.users to call handle_new_user
-- This trigger should fire after a user is inserted into auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();