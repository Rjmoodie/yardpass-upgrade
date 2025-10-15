-- Migration: add checkout_sessions table and hold extension helper
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  status text DEFAULT 'pending',
  hold_ids uuid[] DEFAULT ARRAY[]::uuid[],
  pricing_snapshot jsonb,
  contact_snapshot jsonb,
  verification_state jsonb,
  express_methods jsonb,
  cart_snapshot jsonb,
  stripe_session_id text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_order ON public.checkout_sessions(order_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_expires ON public.checkout_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_user ON public.checkout_sessions(user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_updated_at_checkout_sessions'
  ) THEN
    CREATE TRIGGER set_updated_at_checkout_sessions
    BEFORE UPDATE ON public.checkout_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.extend_ticket_holds(
  p_session_id text,
  p_extend_minutes integer DEFAULT 10
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer := 0;
  v_new_expiration timestamptz := now() + interval '1 minute' * COALESCE(p_extend_minutes, 10);
BEGIN
  IF p_session_id IS NULL OR length(trim(p_session_id)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_id required');
  END IF;

  UPDATE ticket_holds
  SET expires_at = v_new_expiration
  WHERE session_id = p_session_id
    AND status = 'active'
    AND expires_at > now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'updated', v_rows,
    'expires_at', v_new_expiration
  );
END;
$$;

COMMIT;
