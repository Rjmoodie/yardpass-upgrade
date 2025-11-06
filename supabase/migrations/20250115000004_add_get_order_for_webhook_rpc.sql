-- RPC function to get order by session ID (bypasses view filtering)
-- Used by stripe-webhook to find orders regardless of user session
CREATE OR REPLACE FUNCTION public.get_order_by_session_id(
  p_field TEXT,
  p_value TEXT
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  event_id UUID,
  status TEXT,
  stripe_session_id TEXT,
  checkout_session_id UUID,
  subtotal_cents INTEGER,
  fees_cents INTEGER,
  total_cents INTEGER,
  currency TEXT,
  created_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  contact_email TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  hold_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, ticketing
AS $$
BEGIN
  -- Query ticketing.orders directly, bypassing the filtered public.orders view
  IF p_field = 'stripe_session_id' THEN
    RETURN QUERY
    SELECT 
      o.id,
      o.user_id,
      o.event_id,
      o.status,
      o.stripe_session_id,
      o.checkout_session_id,
      o.subtotal_cents,
      o.fees_cents,
      o.total_cents,
      o.currency,
      o.created_at,
      o.paid_at,
      o.contact_email,
      o.contact_name,
      o.contact_phone,
      o.hold_ids
    FROM ticketing.orders o
    WHERE o.stripe_session_id = p_value
    LIMIT 1;
  ELSIF p_field = 'checkout_session_id' THEN
    RETURN QUERY
    SELECT 
      o.id,
      o.user_id,
      o.event_id,
      o.status,
      o.stripe_session_id,
      o.checkout_session_id,
      o.subtotal_cents,
      o.fees_cents,
      o.total_cents,
      o.currency,
      o.created_at,
      o.paid_at,
      o.contact_email,
      o.contact_name,
      o.contact_phone,
      o.hold_ids
    FROM ticketing.orders o
    WHERE o.checkout_session_id::TEXT = p_value
    LIMIT 1;
  ELSE
    -- Invalid field
    RETURN;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_order_by_session_id IS 'Get order by session ID, bypassing filtered views. Used by webhooks.';

-- Grant execute to service role (Edge Functions)
GRANT EXECUTE ON FUNCTION public.get_order_by_session_id TO service_role, anon, authenticated;

