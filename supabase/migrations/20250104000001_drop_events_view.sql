-- =====================================================
-- CRITICAL FIX: Drop public.events view causing RLS recursion
-- This view is preventing posts from appearing in the feed
-- =====================================================

DROP VIEW IF EXISTS public.events CASCADE;

COMMENT ON FUNCTION public.get_home_feed_ids IS 'Feed includes events AND posts - queries events.events directly to avoid RLS issues';

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';





