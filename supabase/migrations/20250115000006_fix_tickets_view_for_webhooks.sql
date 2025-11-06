-- Fix public.tickets view to allow webhook/system access
-- The view was filtering by auth.uid(), which blocks ticket creation from webhooks

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

COMMENT ON VIEW public.tickets IS 'Tickets view - users see their own, webhooks see all';

GRANT SELECT ON public.tickets TO authenticated, anon, service_role;
GRANT INSERT, UPDATE, DELETE ON public.tickets TO authenticated, service_role;

-- Also ensure the underlying table has proper grants
GRANT SELECT, INSERT, UPDATE ON ticketing.tickets TO service_role;

