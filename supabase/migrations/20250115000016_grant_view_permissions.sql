-- Grant INSERT/UPDATE/DELETE permissions on public.event_comments view
-- The frontend is using the view, not the underlying events.event_comments table

GRANT INSERT, UPDATE, DELETE ON public.event_comments TO authenticated;
GRANT SELECT ON public.event_comments TO authenticated, anon;

-- Also grant on event_reactions view if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'event_reactions') THEN
    GRANT INSERT, UPDATE, DELETE ON public.event_reactions TO authenticated;
    GRANT SELECT ON public.event_reactions TO authenticated, anon;
  END IF;
END $$;

COMMENT ON VIEW public.event_comments IS 
  'Event comments view - grants allow authenticated users to insert/update/delete their own';

