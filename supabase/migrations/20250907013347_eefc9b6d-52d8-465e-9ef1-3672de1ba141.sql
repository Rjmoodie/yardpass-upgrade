-- Fast lookups by slug
CREATE INDEX IF NOT EXISTS idx_events_slug ON public.events (slug);