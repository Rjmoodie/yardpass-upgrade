-- Fix public.event_invites view permissions
-- Problem: View exists but INSERT/UPDATE/DELETE grants are missing

-- Ensure the view exists and is simple (required for INSERT/UPDATE/DELETE)
DROP VIEW IF EXISTS public.event_invites CASCADE;

CREATE VIEW public.event_invites AS
SELECT * FROM events.event_invites;

-- Grant all permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_invites TO authenticated;
GRANT SELECT ON public.event_invites TO anon;

-- Set security invoker (view uses caller's permissions, not definer's)
ALTER VIEW public.event_invites SET (security_invoker = true);

-- Comment
COMMENT ON VIEW public.event_invites IS 
  'Public view for event_invites table. Uses RLS policies from events.event_invites.';

