-- Add missing RLS policies for critical security gaps

-- Fix tickets table - add proper RLS policies
DROP POLICY IF EXISTS "tickets_select_owner_or_manager" ON public.tickets;

CREATE POLICY "tickets_select_owner_or_manager" 
ON public.tickets 
FOR SELECT 
USING (
  (owner_user_id = auth.uid()) 
  OR is_event_manager(event_id)
);

CREATE POLICY "tickets_insert_system_only" 
ON public.tickets 
FOR INSERT 
WITH CHECK (false); -- Only system/service role can insert

CREATE POLICY "tickets_update_system_only" 
ON public.tickets 
FOR UPDATE 
USING (false) 
WITH CHECK (false); -- Only system/service role can update

CREATE POLICY "tickets_delete_system_only" 
ON public.tickets 
FOR DELETE 
USING (false); -- Only system/service role can delete

-- Fix orders table - strengthen RLS
DROP POLICY IF EXISTS "orders_select_owner_or_manager" ON public.orders;

CREATE POLICY "orders_select_owner_or_manager" 
ON public.orders 
FOR SELECT 
USING (
  (user_id = auth.uid()) 
  OR is_event_manager(event_id)
);

CREATE POLICY "orders_insert_own_only" 
ON public.orders 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "orders_update_system_only" 
ON public.orders 
FOR UPDATE 
USING (false) 
WITH CHECK (false);

CREATE POLICY "orders_delete_system_only" 
ON public.orders 
FOR DELETE 
USING (false);

-- Fix ticket_tiers table - add RLS policies
CREATE POLICY "ticket_tiers_select_public_or_manager" 
ON public.ticket_tiers 
FOR SELECT 
USING (
  (status = 'active' AND EXISTS(
    SELECT 1 FROM events e 
    WHERE e.id = ticket_tiers.event_id 
    AND e.visibility IN ('public', 'unlisted')
  ))
  OR is_event_manager(event_id)
);

CREATE POLICY "ticket_tiers_write_manager_only" 
ON public.ticket_tiers 
FOR ALL 
USING (is_event_manager(event_id))
WITH CHECK (is_event_manager(event_id));

-- Strengthen payout_accounts policies
DROP POLICY IF EXISTS "payout_accounts_select_self" ON public.payout_accounts;

CREATE POLICY "payout_accounts_select_self" 
ON public.payout_accounts 
FOR SELECT 
USING (
  (context_type = 'individual' AND context_id = auth.uid())
  OR (context_type = 'organization' AND is_org_role(context_id, ARRAY['admin', 'owner']))
);

CREATE POLICY "payout_accounts_system_only" 
ON public.payout_accounts 
FOR INSERT 
WITH CHECK (false);

CREATE POLICY "payout_accounts_update_system_only" 
ON public.payout_accounts 
FOR UPDATE 
USING (false) 
WITH CHECK (false);

CREATE POLICY "payout_accounts_delete_system_only" 
ON public.payout_accounts 
FOR DELETE 
USING (false);

-- Fix refunds table policies
DROP POLICY IF EXISTS "refunds_select_owner_or_manager" ON public.refunds;

CREATE POLICY "refunds_select_owner_or_manager" 
ON public.refunds 
FOR SELECT 
USING (
  EXISTS(
    SELECT 1 FROM orders o 
    WHERE o.id = refunds.order_id 
    AND (o.user_id = auth.uid() OR is_event_manager(o.event_id))
  )
);

CREATE POLICY "refunds_system_only" 
ON public.refunds 
FOR INSERT 
WITH CHECK (false);

-- Fix order_items table policies  
DROP POLICY IF EXISTS "order_items_select_owner_or_manager" ON public.order_items;

CREATE POLICY "order_items_select_owner_or_manager" 
ON public.order_items 
FOR SELECT 
USING (
  EXISTS(
    SELECT 1 FROM orders o 
    WHERE o.id = order_items.order_id 
    AND (o.user_id = auth.uid() OR is_event_manager(o.event_id))
  )
);

CREATE POLICY "order_items_system_only" 
ON public.order_items 
FOR INSERT 
WITH CHECK (false);

-- Add comprehensive sponsor security
CREATE POLICY "sponsors_read_member_or_public" 
ON public.sponsors 
FOR SELECT 
USING (
  EXISTS(
    SELECT 1 FROM sponsor_members sm 
    WHERE sm.sponsor_id = sponsors.id 
    AND sm.user_id = auth.uid()
  )
);

CREATE POLICY "sponsors_insert_authenticated" 
ON public.sponsors 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "sponsors_update_admin" 
ON public.sponsors 
FOR UPDATE 
USING (
  EXISTS(
    SELECT 1 FROM sponsor_members sm 
    WHERE sm.sponsor_id = sponsors.id 
    AND sm.user_id = auth.uid() 
    AND sm.role IN ('owner', 'admin')
  )
);

-- Drop conflicting policy first
DROP POLICY IF EXISTS "sponsor_rw_members" ON public.sponsors;