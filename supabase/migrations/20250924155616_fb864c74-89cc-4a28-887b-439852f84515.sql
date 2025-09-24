-- Security-hardened RLS policies with proper separation and validation
-- Phase 3: Drop and recreate all policies to avoid conflicts

-- Drop all existing policies first
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all existing policies on sensitive tables
    FOR r IN (
        SELECT tablename, policyname
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('tickets', 'orders', 'order_items', 'ticket_tiers', 'refunds', 'payout_accounts', 'sponsors')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- Ensure RLS is enabled on all sensitive tables
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

-- =========
-- TICKETS: Only owners and event managers can read; service role manages writes
-- =========
CREATE POLICY tickets_select_owner_or_manager
ON public.tickets FOR SELECT
USING (
  owner_user_id = auth.uid()
  OR is_event_manager(event_id)
);

CREATE POLICY tickets_insert_system_only
ON public.tickets FOR INSERT
WITH CHECK (false);

CREATE POLICY tickets_update_system_only
ON public.tickets FOR UPDATE
USING (false) WITH CHECK (false);

CREATE POLICY tickets_delete_system_only
ON public.tickets FOR DELETE
USING (false);

-- =========
-- ORDERS: Buyers and event managers can read; users can create their own
-- =========
CREATE POLICY orders_select_owner_or_manager
ON public.orders FOR SELECT
USING (
  user_id = auth.uid() OR is_event_manager(event_id)
);

CREATE POLICY orders_insert_own_only
ON public.orders FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = orders.event_id
      AND e.visibility IN ('public','unlisted')
  )
);

CREATE POLICY orders_update_system_only
ON public.orders FOR UPDATE
USING (false) WITH CHECK (false);

CREATE POLICY orders_delete_system_only
ON public.orders FOR DELETE
USING (false);

-- =========
-- ORDER ITEMS: Read access tied to parent order
-- =========
CREATE POLICY order_items_select_owner_or_manager
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (o.user_id = auth.uid() OR is_event_manager(o.event_id))
  )
);

CREATE POLICY order_items_write_system_only
ON public.order_items FOR INSERT
WITH CHECK (false);

CREATE POLICY order_items_update_system_only
ON public.order_items FOR UPDATE
USING (false) WITH CHECK (false);

CREATE POLICY order_items_delete_system_only
ON public.order_items FOR DELETE
USING (false);

-- =========
-- TICKET TIERS: Public can read active tiers; managers can manage
-- =========
CREATE POLICY ticket_tiers_select_public_or_manager
ON public.ticket_tiers FOR SELECT
USING (
  (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ticket_tiers.event_id
        AND e.visibility IN ('public','unlisted')
    )
  )
  OR is_event_manager(event_id)
);

CREATE POLICY ticket_tiers_insert_manager_only
ON public.ticket_tiers FOR INSERT
WITH CHECK (is_event_manager(event_id));

CREATE POLICY ticket_tiers_update_manager_only
ON public.ticket_tiers FOR UPDATE
USING (is_event_manager(event_id))
WITH CHECK (is_event_manager(event_id));

CREATE POLICY ticket_tiers_delete_manager_only
ON public.ticket_tiers FOR DELETE
USING (is_event_manager(event_id));

-- =========
-- REFUNDS: Read access tied to parent order
-- =========
CREATE POLICY refunds_select_owner_or_manager
ON public.refunds FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = refunds.order_id
      AND (o.user_id = auth.uid() OR is_event_manager(o.event_id))
  )
);

CREATE POLICY refunds_write_system_only
ON public.refunds FOR INSERT
WITH CHECK (false);

CREATE POLICY refunds_update_system_only
ON public.refunds FOR UPDATE
USING (false) WITH CHECK (false);

CREATE POLICY refunds_delete_system_only
ON public.refunds FOR DELETE
USING (false);

-- =========
-- PAYOUT ACCOUNTS: Individual/org owners only; service manages writes
-- =========
CREATE POLICY payout_accounts_select_self
ON public.payout_accounts FOR SELECT
USING (
  (context_type = 'individual' AND context_id = auth.uid())
  OR (context_type = 'organization' AND is_org_role(context_id, ARRAY['admin','owner']))
);

CREATE POLICY payout_accounts_insert_system_only
ON public.payout_accounts FOR INSERT
WITH CHECK (false);

CREATE POLICY payout_accounts_update_system_only
ON public.payout_accounts FOR UPDATE
USING (false) WITH CHECK (false);

CREATE POLICY payout_accounts_delete_system_only
ON public.payout_accounts FOR DELETE
USING (false);

-- =========
-- SPONSORS: Members only read; creators can create; owners/admins can update
-- =========
CREATE POLICY sponsors_read_member_only
ON public.sponsors FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sponsor_members sm
    WHERE sm.sponsor_id = sponsors.id
      AND sm.user_id = auth.uid()
  )
);

CREATE POLICY sponsors_insert_authenticated
ON public.sponsors FOR INSERT
WITH CHECK (created_by = auth.uid());

CREATE POLICY sponsors_update_admin_only
ON public.sponsors FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.sponsor_members sm
    WHERE sm.sponsor_id = sponsors.id
      AND sm.user_id = auth.uid()
      AND sm.role IN ('owner','admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sponsor_members sm
    WHERE sm.sponsor_id = sponsors.id
      AND sm.user_id = auth.uid()
      AND sm.role IN ('owner','admin')
  )
);

-- Add performance indexes for RLS policies
CREATE INDEX IF NOT EXISTS idx_tickets_event_owner 
ON public.tickets(event_id, owner_user_id);

CREATE INDEX IF NOT EXISTS idx_orders_event_user 
ON public.orders(event_id, user_id);

CREATE INDEX IF NOT EXISTS idx_order_items_order 
ON public.order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event_status 
ON public.ticket_tiers(event_id, status);

CREATE INDEX IF NOT EXISTS idx_sponsor_members_sponsor_user 
ON public.sponsor_members(sponsor_id, user_id);

CREATE INDEX IF NOT EXISTS idx_payout_accounts_context 
ON public.payout_accounts(context_type, context_id);