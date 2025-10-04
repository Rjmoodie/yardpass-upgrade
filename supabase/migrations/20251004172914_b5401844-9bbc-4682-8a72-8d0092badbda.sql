-- Performance indexes for unified feed ranking

-- Posts by recency per event (and skipping soft-deleted)
CREATE INDEX IF NOT EXISTS idx_event_posts_event_created
  ON public.event_posts (event_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Recent activity aggregation
CREATE INDEX IF NOT EXISTS idx_event_posts_recent_activity
  ON public.event_posts (event_id, created_at)
  WHERE deleted_at IS NULL;

-- Follows lookups
CREATE INDEX IF NOT EXISTS idx_follows_user_target
  ON public.follows (follower_user_id, target_type, target_id);