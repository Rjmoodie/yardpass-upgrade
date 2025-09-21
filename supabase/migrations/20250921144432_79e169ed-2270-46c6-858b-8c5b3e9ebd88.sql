-- Performance optimizations for YardPass database

-- Add database indexes for frequently queried columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_visibility_start_at ON events(visibility, start_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_created_by_start_at ON events(created_by, start_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_posts_event_id_created_at ON event_posts(event_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_posts_author_created_at ON event_posts(author_user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_reactions_post_id_kind ON event_reactions(post_id, kind);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_comments_post_id_created_at ON event_comments(post_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_owner_status ON tickets(owner_user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tickets_event_status ON tickets(event_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_status_paid_at ON orders(user_id, status, paid_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follows_follower_target ON follows(follower_user_id, target_type, target_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_profiles_display_name ON user_profiles(display_name);

-- Add indexes for analytics tables
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_event_id_created_at ON analytics_events(event_id, created_at) WHERE event_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_user_id_created_at ON analytics_events(user_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_views_event_id_created_at ON post_views(event_id, created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_clicks_event_id_created_at ON post_clicks(event_id, created_at);

-- Update statistics for query planner
ANALYZE events;
ANALYZE event_posts;
ANALYZE event_reactions;
ANALYZE event_comments;
ANALYZE tickets;
ANALYZE orders;
ANALYZE user_profiles;