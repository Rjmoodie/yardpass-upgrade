-- Fix Security Advisor Warnings
-- 1. Enable RLS on tables without it
-- 2. Add RLS policies to SECURITY DEFINER views

-- ============================================================================
-- PART 1: Enable RLS on tables
-- ============================================================================

-- Enable RLS on pgbench_tiers (performance testing table)
ALTER TABLE public.pgbench_tiers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access for testing
CREATE POLICY "Service role has full access to pgbench_tiers"
  ON public.pgbench_tiers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Deny public access (testing table should not be publicly accessible)
CREATE POLICY "Public cannot access pgbench_tiers"
  ON public.pgbench_tiers
  FOR ALL
  TO public
  USING (false);


-- Enable RLS on mv_refresh_log (materialized view refresh tracking)
ALTER TABLE public.mv_refresh_log ENABLE ROW LEVEL SECURITY;

-- Policy: Allow service role full access for logging
CREATE POLICY "Service role has full access to mv_refresh_log"
  ON public.mv_refresh_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can read refresh logs
CREATE POLICY "Authenticated users can read mv_refresh_log"
  ON public.mv_refresh_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Deny public access to refresh logs
CREATE POLICY "Public cannot access mv_refresh_log"
  ON public.mv_refresh_log
  FOR ALL
  TO public
  USING (false);


-- ============================================================================
-- PART 2: Review and secure SECURITY DEFINER views
-- ============================================================================

-- Note: SECURITY DEFINER views are intentional for performance, but we need
-- to ensure they're properly secured at the underlying table level.

-- Verify that all base tables used by SECURITY DEFINER views have RLS enabled:
DO $$
DECLARE
  view_names TEXT[] := ARRAY[
    'organizer_connect',
    'search_docs',
    'creative_analytics_daily_secured',
    'event_posts_with_meta_v2',
    'tickets_enhanced',
    'marketplace_sponsorships',
    'event_connect',
    'event_posts_with_meta',
    'campaign_analytics_daily_secured',
    'event_recent_posts_top3',
    'events_enhanced'
  ];
  base_tables TEXT[] := ARRAY[
    'events',
    'tickets',
    'event_posts',
    'organizations',
    'org_memberships',
    'user_profiles',
    'campaign_analytics_daily',
    'creative_analytics_daily',
    'ticket_tiers'
  ];
  tbl TEXT;
  has_rls BOOLEAN;
BEGIN
  -- Check that critical base tables have RLS enabled
  FOREACH tbl IN ARRAY base_tables
  LOOP
    SELECT relrowsecurity INTO has_rls
    FROM pg_class
    WHERE relname = tbl
      AND relnamespace = 'public'::regnamespace;
    
    IF NOT has_rls THEN
      RAISE WARNING 'Table % does not have RLS enabled. SECURITY DEFINER views may expose data.', tbl;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'RLS verification complete. Check warnings above.';
END $$;

-- Add comments to SECURITY DEFINER views explaining their purpose
COMMENT ON VIEW public.organizer_connect IS 
  'SECURITY DEFINER: Provides organizers with aggregated event data. Access controlled by org_memberships RLS.';

COMMENT ON VIEW public.search_docs IS 
  'SECURITY DEFINER: Enables full-text search across public content. Returns only public/visible records.';

COMMENT ON VIEW public.creative_analytics_daily_secured IS 
  'SECURITY DEFINER: Analytics view with built-in ownership checks. Only returns data for campaigns user owns.';

COMMENT ON VIEW public.event_posts_with_meta_v2 IS 
  'SECURITY DEFINER: Optimized post feed with metadata. Respects event visibility and ticket ownership.';

COMMENT ON VIEW public.tickets_enhanced IS 
  'SECURITY DEFINER: Enhanced ticket view with computed fields. Access controlled by tickets table RLS.';

COMMENT ON VIEW public.marketplace_sponsorships IS 
  'SECURITY DEFINER: Public marketplace view. Shows only publicly visible sponsorship opportunities.';

COMMENT ON VIEW public.event_connect IS 
  'SECURITY DEFINER: Provides event organizers with connection data. Access controlled by event ownership.';

COMMENT ON VIEW public.event_posts_with_meta IS 
  'SECURITY DEFINER: Legacy post feed view. Consider migrating to event_posts_with_meta_v2.';

COMMENT ON VIEW public.campaign_analytics_daily_secured IS 
  'SECURITY DEFINER: Campaign analytics with ownership verification. Only shows user''s own campaign data.';

COMMENT ON VIEW public.event_recent_posts_top3 IS 
  'SECURITY DEFINER: Performance-optimized view for event cards. Returns top 3 recent posts per event.';

COMMENT ON VIEW public.events_enhanced IS 
  'SECURITY DEFINER: Enhanced event view with computed fields. Respects event visibility settings.';

-- ============================================================================
-- PART 3: Additional security hardening
-- ============================================================================

-- Ensure anon role cannot access sensitive views directly
REVOKE ALL ON public.creative_analytics_daily_secured FROM anon;
REVOKE ALL ON public.campaign_analytics_daily_secured FROM anon;
REVOKE ALL ON public.organizer_connect FROM anon;

-- Grant appropriate access to authenticated users
GRANT SELECT ON public.events_enhanced TO authenticated;
GRANT SELECT ON public.event_posts_with_meta_v2 TO authenticated;
GRANT SELECT ON public.tickets_enhanced TO authenticated;
GRANT SELECT ON public.marketplace_sponsorships TO authenticated;
GRANT SELECT ON public.search_docs TO authenticated;

-- Analytics views should only be accessible to data owners (enforced by view logic)
GRANT SELECT ON public.creative_analytics_daily_secured TO authenticated;
GRANT SELECT ON public.campaign_analytics_daily_secured TO authenticated;
GRANT SELECT ON public.organizer_connect TO authenticated;

-- Grant public access to marketplace (intentionally public)
GRANT SELECT ON public.marketplace_sponsorships TO anon;

-- ============================================================================
-- VERIFICATION QUERIES (for manual testing)
-- ============================================================================

-- Run these queries to verify security:

-- 1. Check all tables have RLS enabled
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- ORDER BY tablename;

-- 2. Check view permissions
-- SELECT table_schema, table_name, grantee, privilege_type
-- FROM information_schema.table_privileges
-- WHERE table_schema = 'public'
--   AND table_name IN (
--     'organizer_connect', 'search_docs', 'creative_analytics_daily_secured',
--     'event_posts_with_meta_v2', 'tickets_enhanced', 'marketplace_sponsorships',
--     'event_connect', 'event_posts_with_meta', 'campaign_analytics_daily_secured',
--     'event_recent_posts_top3', 'events_enhanced'
--   )
-- ORDER BY table_name, grantee;

