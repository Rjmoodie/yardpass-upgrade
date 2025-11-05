-- Use ALTER FUNCTION to explicitly set SECURITY DEFINER
-- CREATE OR REPLACE doesn't always update the security attribute

ALTER FUNCTION public.can_current_user_post(uuid) SECURITY DEFINER;
ALTER FUNCTION public.can_post_to_flashback(uuid) SECURITY DEFINER;

-- Also check if is_event_manager needs it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_event_manager'
      AND pronamespace = 'public'::regnamespace
  ) THEN
    ALTER FUNCTION public.is_event_manager(uuid) SECURITY DEFINER;
  END IF;
END $$;

COMMENT ON FUNCTION public.can_current_user_post IS
'SECURITY DEFINER added to prevent infinite RLS recursion when called from policies';

COMMENT ON FUNCTION public.can_post_to_flashback IS
'SECURITY DEFINER added to prevent infinite RLS recursion when called from policies';





