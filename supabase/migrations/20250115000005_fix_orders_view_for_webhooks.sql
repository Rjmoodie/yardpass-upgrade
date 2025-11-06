-- Fix public.orders view to allow webhook access
-- The view was filtering WHERE user_id = auth.uid(), which blocks webhooks (auth.uid() = NULL)

DROP VIEW IF EXISTS public.orders CASCADE;

CREATE VIEW public.orders
WITH (security_invoker=false)
AS
SELECT 
  id,
  user_id,
  event_id,
  status,
  subtotal_cents,
  fees_cents,
  total_cents,
  currency,
  stripe_session_id,
  stripe_payment_intent_id,
  payout_destination_owner,
  payout_destination_id,
  created_at,
  paid_at,
  hold_ids,
  tickets_issued_count,
  checkout_session_id,
  contact_email,
  contact_name,
  contact_phone
FROM ticketing.orders o
WHERE (
  -- Allow user to see their own orders
  user_id = auth.uid()
  -- OR allow system/webhook access (when auth.uid() is NULL)
  OR auth.uid() IS NULL
);

COMMENT ON VIEW public.orders IS 'Orders view - users see their own, webhooks see all';

GRANT SELECT ON public.orders TO authenticated, anon, service_role;
GRANT INSERT, UPDATE, DELETE ON public.orders TO authenticated;

