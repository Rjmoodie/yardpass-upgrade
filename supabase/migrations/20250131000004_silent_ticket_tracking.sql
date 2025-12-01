-- Migration: Silent Ticket Detail View Tracking
-- Date: 2025-01-31
-- Purpose: Prevent 409 errors in console by using RPC function with ON CONFLICT DO NOTHING
--
-- This RPC function silently handles duplicate inserts at the database level,
-- preventing the Supabase client from logging 409 Conflict errors to the console.

-- ==========================================
-- RPC Function: track_ticket_detail_view
-- ==========================================

CREATE OR REPLACE FUNCTION public.track_ticket_detail_view(
  p_event_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL,
  p_tier_viewed TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hour_bucket TIMESTAMPTZ;
  v_id UUID;
BEGIN
  -- Calculate hour bucket (same logic as frontend)
  v_hour_bucket := date_trunc('hour', now());
  
  -- Insert with ON CONFLICT DO NOTHING to silently handle duplicates
  -- This prevents 409 errors from being raised at the HTTP level
  INSERT INTO public.ticket_detail_views (
    event_id,
    user_id,
    session_id,
    tier_viewed,
    hour_bucket,
    viewed_at
  )
  VALUES (
    p_event_id,
    p_user_id,
    COALESCE(p_session_id, gen_random_uuid()::TEXT),
    p_tier_viewed,
    v_hour_bucket,
    now()
  )
  ON CONFLICT (user_id, event_id, hour_bucket) 
  WHERE user_id IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_id;
  
  -- Return the ID if inserted, or NULL if duplicate (conflict)
  RETURN v_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.track_ticket_detail_view TO authenticated, anon, service_role;

-- Add comment
COMMENT ON FUNCTION public.track_ticket_detail_view IS 
  'Silently tracks ticket detail views with automatic deduplication. Returns UUID if inserted, NULL if duplicate. Prevents 409 errors in console.';

-- ==========================================
-- Success Message
-- ==========================================

DO $$
BEGIN
  RAISE NOTICE '✅ Created public.track_ticket_detail_view() RPC function';
  RAISE NOTICE '✅ Function uses ON CONFLICT DO NOTHING to prevent 409 errors';
END $$;

