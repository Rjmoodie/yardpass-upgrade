-- Ensure RLS policies are compatible with the get-user-tickets function

-- Drop and recreate policies to ensure they exist and are correct
DROP POLICY IF EXISTS "tickets_select_own" ON public.tickets;
DROP POLICY IF EXISTS "events_public_read" ON public.events;
DROP POLICY IF EXISTS "ticket_tiers_read_all" ON public.ticket_tiers;

-- Tickets must allow owners to read
CREATE POLICY "tickets_select_own"
ON public.tickets FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

-- Events should be readable for referenced fields (title, cover)
-- Public read for 'public' events
CREATE POLICY "events_public_read"
ON public.events FOR SELECT
TO public
USING (visibility = 'public');

-- Ticket tiers public read
CREATE POLICY "ticket_tiers_read_all"
ON public.ticket_tiers FOR SELECT
TO public
USING (true);