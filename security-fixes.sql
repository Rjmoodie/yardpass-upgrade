-- ============================================================================
-- SECURITY ADVISOR FIXES
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/sql
-- ============================================================================

-- ============================================================================
-- PART 1: Enable RLS on tables without it
-- ============================================================================

-- Enable RLS on pgbench_tiers (performance testing table)
ALTER TABLE IF EXISTS public.pgbench_tiers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role has full access to pgbench_tiers" ON public.pgbench_tiers;
DROP POLICY IF EXISTS "Public cannot access pgbench_tiers" ON public.pgbench_tiers;

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
ALTER TABLE IF EXISTS public.mv_refresh_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role has full access to mv_refresh_log" ON public.mv_refresh_log;
DROP POLICY IF EXISTS "Authenticated users can read mv_refresh_log" ON public.mv_refresh_log;
DROP POLICY IF EXISTS "Public cannot access mv_refresh_log" ON public.mv_refresh_log;

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
-- PART 2: Secure SECURITY DEFINER views with proper permissions
-- ============================================================================

-- Revoke anon access from sensitive analytics views
REVOKE ALL ON public.creative_analytics_daily_secured FROM anon;
REVOKE ALL ON public.campaign_analytics_daily_secured FROM anon;
REVOKE ALL ON public.organizer_connect FROM anon;

-- Grant appropriate access to authenticated users for public views
GRANT SELECT ON public.events_enhanced TO authenticated;
GRANT SELECT ON public.event_posts_with_meta_v2 TO authenticated;
GRANT SELECT ON public.tickets_enhanced TO authenticated;
GRANT SELECT ON public.marketplace_sponsorships TO authenticated;
GRANT SELECT ON public.search_docs TO authenticated;

-- Analytics views (have built-in ownership checks in their SQL)
GRANT SELECT ON public.creative_analytics_daily_secured TO authenticated;
GRANT SELECT ON public.campaign_analytics_daily_secured TO authenticated;
GRANT SELECT ON public.organizer_connect TO authenticated;

-- Grant public access to marketplace (intentionally public)
GRANT SELECT ON public.marketplace_sponsorships TO anon;


-- ============================================================================
-- PART 3: Add documentation to views
-- ============================================================================

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
-- VERIFICATION
-- ============================================================================

-- Check RLS status on tables
SELECT 
  schemaname, 
  tablename, 
  CASE WHEN rowsecurity THEN '✅ Enabled' ELSE '❌ Disabled' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('pgbench_tiers', 'mv_refresh_log')
ORDER BY tablename;

