-- Performance indexes for the enhanced search_all function

-- Full-text search indexes using simple configuration
CREATE INDEX IF NOT EXISTS events_fts_idx
  ON public.events
  USING GIN (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,'')));

CREATE INDEX IF NOT EXISTS event_posts_fts_idx
  ON public.event_posts
  USING GIN (to_tsvector('simple', coalesce(text,'')));

-- Common filter indexes for search performance
CREATE INDEX IF NOT EXISTS events_start_at_idx ON public.events (start_at);
CREATE INDEX IF NOT EXISTS events_visibility_idx ON public.events (visibility);
CREATE INDEX IF NOT EXISTS events_category_idx ON public.events (category);
CREATE INDEX IF NOT EXISTS event_posts_event_id_idx ON public.event_posts (event_id);

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS events_visibility_category_idx ON public.events (visibility, category);
CREATE INDEX IF NOT EXISTS events_visibility_start_at_idx ON public.events (visibility, start_at);

-- Index for post deletion checks
CREATE INDEX IF NOT EXISTS event_posts_deleted_at_idx ON public.event_posts (deleted_at) WHERE deleted_at IS NULL;