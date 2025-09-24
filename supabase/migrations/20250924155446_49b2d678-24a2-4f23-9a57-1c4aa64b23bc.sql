-- Security-hardened RLS policies with proper separation and validation
-- Based on security review feedback

-- =========
-- TICKETS
-- =========
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS tickets_select_owner_or_manager ON public.tickets;
  DROP POLICY IF EXISTS tickets_insert_system_only ON public.tickets;
  DROP POLICY IF EXISTS tickets_update_system_only ON public.tickets;
  DROP POLICY IF EXISTS tickets_delete_system_only ON public.tickets;
END $$;

-- Read: ticket owner, holder, event managers, and (optionally) scanners
CREATE POLICY tickets_select_owner_or_manager
ON public.tickets FOR SELECT
USING (
  owner_user_id = auth.uid()
  OR is_event_manager(event_id)
);

-- App never inserts tickets directly; service role does
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
-- ORDERS
-- =========
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS orders_select_owner_or_manager ON public.orders;
  DROP POLICY IF EXISTS orders_insert_own_only ON public.orders;
  DROP POLICY IF EXISTS orders_update_system_only ON public.orders;
  DROP POLICY IF EXISTS orders_delete_system_only ON public.orders;
END $$;

-- Read: buyer or event manager
CREATE POLICY orders_select_owner_or_manager
ON public.orders FOR SELECT
USING (
  user_id = auth.uid() OR is_event_manager(event_id)
);

-- Insert: buyer can create their own order, and event must be purchasable
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

-- Updates (status/reconciliation) only by service role
CREATE POLICY orders_update_system_only
ON public.orders FOR UPDATE
USING (false) WITH CHECK (false);

CREATE POLICY orders_delete_system_only
ON public.orders FOR DELETE
USING (false);

-- =========
-- ORDER ITEMS
-- =========
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS order_items_select_owner_or_manager ON public.order_items;
  DROP POLICY IF EXISTS order_items_system_only ON public.order_items;
END $$;

-- Read: tied to parent order read
CREATE POLICY order_items_select_owner_or_manager
ON public.order_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (o.user_id = auth.uid() OR is_event_manager(o.event_id))
  )
);

-- Write: service only (items created by server on checkout)
CREATE POLICY order_items_system_only
ON public.order_items FOR ALL
USING (false) WITH CHECK (false);

-- =========
-- TICKET TIERS
-- =========
ALTER TABLE public.ticket_tiers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS ticket_tiers_select_public_or_manager ON public.ticket_tiers;
  DROP POLICY IF EXISTS ticket_tiers_write_manager_only ON public.ticket_tiers;
END $$;

-- Public can read active tiers of publicly visible events; organizers/managers can read all
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

-- Writes: managers only (insert/update/delete)
CREATE POLICY ticket_tiers_write_manager_only
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
-- REFUNDS
-- =========
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS refunds_select_owner_or_manager ON public.refunds;
  DROP POLICY IF EXISTS refunds_system_only ON public.refunds;
END $$;

CREATE POLICY refunds_select_owner_or_manager
ON public.refunds FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = refunds.order_id
      AND (o.user_id = auth.uid() OR is_event_manager(o.event_id))
  )
);

-- Create refunds only by service role (webhook/backoffice)
CREATE POLICY refunds_system_only
ON public.refunds FOR ALL
USING (false) WITH CHECK (false);

-- =========
-- PAYOUT ACCOUNTS
-- =========
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS payout_accounts_select_self ON public.payout_accounts;
  DROP POLICY IF EXISTS payout_accounts_system_only ON public.payout_accounts;
  DROP POLICY IF EXISTS payout_accounts_update_system_only ON public.payout_accounts;
  DROP POLICY IF EXISTS payout_accounts_delete_system_only ON public.payout_accounts;
END $$;

-- Read: individual sees their own; org admins/owners see org
CREATE POLICY payout_accounts_select_self
ON public.payout_accounts FOR SELECT
USING (
  (context_type = 'individual' AND context_id = auth.uid())
  OR (context_type = 'organization' AND is_org_role(context_id, ARRAY['admin','owner']))
);

-- Writes: service role only (Connect onboarding callback)
CREATE POLICY payout_accounts_system_only
ON public.payout_accounts FOR INSERT
WITH CHECK (false);

CREATE POLICY payout_accounts_update_system_only
ON public.payout_accounts FOR UPDATE
USING (false) WITH CHECK (false);

CREATE POLICY payout_accounts_delete_system_only
ON public.payout_accounts FOR DELETE
USING (false);

-- =========
-- SPONSORS
-- =========
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS sponsors_read_member_or_public ON public.sponsors;
  DROP POLICY IF EXISTS sponsors_insert_authenticated ON public.sponsors;
  DROP POLICY IF EXISTS sponsors_update_admin ON public.sponsors;
  DROP POLICY IF EXISTS sponsor_rw_members ON public.sponsors;
END $$;

-- Conservative: members only see their sponsor account
CREATE POLICY sponsors_read_member
ON public.sponsors FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sponsor_members sm
    WHERE sm.sponsor_id = sponsors.id
      AND sm.user_id = auth.uid()
  )
);

-- Create: user can create sponsor where created_by = self
CREATE POLICY sponsors_insert_authenticated
ON public.sponsors FOR INSERT
WITH CHECK (created_by = auth.uid());

-- Update: owners/admins only
CREATE POLICY sponsors_update_admin
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

-- =========
-- PERFORMANCE INDEXES FOR RLS POLICIES
-- =========

-- Create indexes to optimize policy checks
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