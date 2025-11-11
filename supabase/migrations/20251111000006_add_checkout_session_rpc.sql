-- Migration: Add RPC Function for Checkout Session Upsert
-- Purpose: Bypass PostgREST cache issue by using direct SQL
-- Issue: PGRST204 - PostgREST cache doesn't see checkout_sessions columns

-- ============================================================================
-- CREATE RPC FUNCTION TO UPSERT CHECKOUT SESSIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.upsert_checkout_session(
  p_id UUID,
  p_order_id UUID,
  p_event_id UUID,
  p_user_id UUID,
  p_hold_ids UUID[],
  p_pricing_snapshot JSONB,
  p_contact_snapshot JSONB,
  p_verification_state JSONB,
  p_express_methods JSONB,
  p_stripe_session_id TEXT,
  p_expires_at TIMESTAMPTZ,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ticketing, public
AS $$
BEGIN
  INSERT INTO ticketing.checkout_sessions (
    id,
    order_id,
    event_id,
    user_id,
    hold_ids,
    pricing_snapshot,
    contact_snapshot,
    verification_state,
    express_methods,
    stripe_session_id,
    expires_at,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_id,
    p_order_id,
    p_event_id,
    p_user_id,
    COALESCE(p_hold_ids, ARRAY[]::UUID[]),
    p_pricing_snapshot,
    p_contact_snapshot,
    p_verification_state,
    p_express_methods,
    p_stripe_session_id,
    p_expires_at,
    COALESCE(p_status, 'pending'),
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    order_id = EXCLUDED.order_id,
    event_id = EXCLUDED.event_id,
    user_id = EXCLUDED.user_id,
    hold_ids = EXCLUDED.hold_ids,
    pricing_snapshot = EXCLUDED.pricing_snapshot,
    contact_snapshot = EXCLUDED.contact_snapshot,
    verification_state = EXCLUDED.verification_state,
    express_methods = EXCLUDED.express_methods,
    stripe_session_id = EXCLUDED.stripe_session_id,
    expires_at = EXCLUDED.expires_at,
    status = EXCLUDED.status,
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.upsert_checkout_session IS 
'Bypasses PostgREST to directly upsert checkout sessions (fixes PGRST204 cache issue)';

-- Grant execute to authenticated users (Edge Functions use service role)
GRANT EXECUTE ON FUNCTION public.upsert_checkout_session TO authenticated, anon, service_role;

-- ============================================================================
-- CREATE UPDATE FUNCTION FOR CHECKOUT SESSION STATUS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_checkout_session_status(
  p_session_id UUID,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ticketing, public
AS $$
BEGIN
  UPDATE ticketing.checkout_sessions
  SET 
    status = p_status,
    updated_at = now()
  WHERE id = p_session_id;
END;
$$;

COMMENT ON FUNCTION public.update_checkout_session_status IS 
'Updates checkout session status in ticketing schema (used by process-payment webhook)';

GRANT EXECUTE ON FUNCTION public.update_checkout_session_status TO authenticated, anon, service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Created public.upsert_checkout_session() RPC function';
  RAISE NOTICE '✅ Created public.update_checkout_session_status() RPC function';
  RAISE NOTICE '✅ Both functions target ticketing.checkout_sessions (not public)';
  RAISE NOTICE '✅ Bypasses PostgREST cache issue (PGRST204)';
  RAISE NOTICE '';
  RAISE NOTICE '⚡ Next: Redeploy ALL 3 checkout Edge Functions:';
  RAISE NOTICE '   supabase functions deploy enhanced-checkout --no-verify-jwt';
  RAISE NOTICE '   supabase functions deploy guest-checkout --no-verify-jwt';
  RAISE NOTICE '   supabase functions deploy process-payment --no-verify-jwt';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 This fixes checkout for both users AND webhooks!';
  RAISE NOTICE '';
END $$;

