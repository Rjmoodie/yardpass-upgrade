-- Grant INSERT permissions on public.event_posts view
-- Following the pattern: views need explicit grants even if underlying tables have RLS

-- Check if event_posts view exists and grant permissions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'event_posts') THEN
    GRANT INSERT, UPDATE, DELETE ON public.event_posts TO authenticated;
    GRANT SELECT ON public.event_posts TO authenticated, anon;
    
    RAISE NOTICE 'Granted permissions on public.event_posts view';
  ELSE
    RAISE NOTICE 'No public.event_posts view found - using events.event_posts table directly';
  END IF;
END $$;

-- Also check for event_reactions view
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'event_reactions') THEN
    GRANT INSERT, UPDATE, DELETE ON public.event_reactions TO authenticated;
    GRANT SELECT ON public.event_reactions TO authenticated, anon;
    
    RAISE NOTICE 'Granted permissions on public.event_reactions view';
  END IF;
END $$;

COMMENT ON VIEW public.event_posts IS 
  'Event posts view - authenticated users can insert/update/delete via this view';

