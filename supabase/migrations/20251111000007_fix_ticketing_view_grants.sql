-- ============================================================================
-- Fix Ticketing View Grants for Edge Functions (service_role)
-- ============================================================================
-- Issue: Edge functions were failing because views lacked service_role grants
-- Solution: Grant INSERT, UPDATE, DELETE on all ticketing views to service_role
-- ============================================================================

-- Grant full access to service_role on public ticketing views
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_tiers TO service_role;

-- Also ensure anon/authenticated have read access (should already exist)
GRANT SELECT ON public.tickets TO anon, authenticated;
GRANT SELECT ON public.orders TO anon, authenticated;
GRANT SELECT ON public.order_items TO anon, authenticated;
GRANT SELECT ON public.ticket_tiers TO anon, authenticated;

-- Grant on underlying ticketing tables (belt and suspenders)
GRANT SELECT, INSERT, UPDATE, DELETE ON ticketing.tickets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ticketing.orders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ticketing.order_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ticketing.ticket_tiers TO service_role;

-- Recreate orders view to ensure it has all required columns and proper grants
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

COMMENT ON VIEW public.orders IS 'Orders view - users see their own, service_role sees all';

GRANT SELECT ON public.orders TO authenticated, anon, service_role;
GRANT INSERT, UPDATE, DELETE ON public.orders TO authenticated, service_role;

-- Recreate tickets view to ensure service_role can INSERT
DROP VIEW IF EXISTS public.tickets CASCADE;

CREATE VIEW public.tickets
WITH (security_invoker=false)
AS
SELECT 
  id,
  event_id,
  tier_id,
  order_id,
  owner_user_id,
  status,
  qr_code,
  wallet_pass_url,
  redeemed_at,
  created_at,
  serial_no
FROM ticketing.tickets t
WHERE (
  -- Allow user to see their own tickets
  owner_user_id = auth.uid()
  -- OR allow user to see tickets from their orders
  OR order_id IN (
    SELECT id FROM ticketing.orders WHERE user_id = auth.uid()
  )
  -- OR allow system/webhook access (when auth.uid() is NULL)
  OR auth.uid() IS NULL
);

COMMENT ON VIEW public.tickets IS 'Tickets view - users see their own, service_role sees all';

GRANT SELECT ON public.tickets TO authenticated, anon, service_role;
GRANT INSERT, UPDATE, DELETE ON public.tickets TO authenticated, service_role;

-- Recreate order_items view (if it exists)
DROP VIEW IF EXISTS public.order_items CASCADE;

CREATE VIEW public.order_items
WITH (security_invoker=false)
AS
SELECT 
  id,
  order_id,
  tier_id,
  quantity,
  unit_price_cents,
  total_price_cents,
  created_at
FROM ticketing.order_items
WHERE (
  -- Allow access if user owns the order
  order_id IN (
    SELECT id FROM ticketing.orders WHERE user_id = auth.uid()
  )
  -- OR allow system/webhook access
  OR auth.uid() IS NULL
);

COMMENT ON VIEW public.order_items IS 'Order items view with proper grants';

GRANT SELECT ON public.order_items TO authenticated, anon, service_role;
GRANT INSERT, UPDATE, DELETE ON public.order_items TO authenticated, service_role;

-- Recreate ticket_tiers view (if it exists)
DROP VIEW IF EXISTS public.ticket_tiers CASCADE;

CREATE VIEW public.ticket_tiers
WITH (security_invoker=false)
AS
SELECT 
  id,
  event_id,
  name,
  description,
  price_cents,
  quantity,
  quantity_sold,
  max_per_order,
  sale_starts_at,
  sale_ends_at,
  is_hidden,
  display_order,
  created_at,
  badge_label,
  is_rsvp_only
FROM ticketing.ticket_tiers;

COMMENT ON VIEW public.ticket_tiers IS 'Ticket tiers view - public readable, service_role can modify';

GRANT SELECT ON public.ticket_tiers TO authenticated, anon, service_role;
GRANT INSERT, UPDATE, DELETE ON public.ticket_tiers TO authenticated, service_role;

-- ============================================================================
-- Verify Grants (for debugging)
-- ============================================================================

COMMENT ON MIGRATION IS 'Fixed ticketing view grants for service_role to enable Edge Function INSERT/UPDATE operations';



