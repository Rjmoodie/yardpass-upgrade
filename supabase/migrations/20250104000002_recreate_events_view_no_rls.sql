-- =====================================================
-- RECREATE public.events VIEW WITHOUT RLS
-- This view is needed by get_home_feed_ids which uses unqualified "events"
-- =====================================================

-- Create the view with security_barrier = false to avoid RLS recursion
CREATE OR REPLACE VIEW public.events
WITH (security_barrier = false)
AS SELECT * FROM events.events;

-- Do NOT enable RLS on the view (this is key!)
-- RLS is already enforced on events.events

-- Grant permissions
GRANT SELECT ON public.events TO authenticated, anon;

-- Reload PostgREST
NOTIFY pgrst, 'reload schema';

COMMENT ON VIEW public.events IS 'Public schema view of events.events - security_barrier disabled to avoid RLS recursion in feed functions';





