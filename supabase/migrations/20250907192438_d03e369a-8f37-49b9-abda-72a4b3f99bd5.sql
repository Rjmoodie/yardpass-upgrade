CREATE INDEX IF NOT EXISTS idx_tickets_owner ON public.tickets(owner_user_id, status, event_id);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON public.events(created_by);
CREATE INDEX IF NOT EXISTS idx_event_posts_event_created ON public.event_posts(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event_sort ON public.ticket_tiers(event_id, status, sort_index);