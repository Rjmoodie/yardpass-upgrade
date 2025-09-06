-- Ensure RLS policies are compatible with the get-user-tickets function

-- Tickets must allow owners to read
CREATE POLICY IF NOT EXISTS "tickets_select_own"
ON public.tickets FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid());

-- Events should be readable for referenced fields (title, cover)
-- If you have visibility, you can do public read for 'public' events
CREATE POLICY IF NOT EXISTS "events_public_read"
ON public.events FOR SELECT
TO public
USING (visibility = 'public');

-- Ticket tiers public read is usually fine
CREATE POLICY IF NOT EXISTS "ticket_tiers_read_all"
ON public.ticket_tiers FOR SELECT
TO public
USING (true);