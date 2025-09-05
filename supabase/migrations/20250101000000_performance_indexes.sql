-- Performance optimization indexes for YardPass
-- These indexes will significantly improve query performance

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name ON user_profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_verification_status ON user_profiles(verification_status);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_city ON events(city);
CREATE INDEX IF NOT EXISTS idx_events_venue ON events(venue);
CREATE INDEX IF NOT EXISTS idx_events_visibility_start_at ON events(visibility, start_at);
CREATE INDEX IF NOT EXISTS idx_events_category_start_at ON events(category, start_at);

-- Tickets indexes
CREATE INDEX IF NOT EXISTS idx_tickets_owner_user_id ON tickets(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tier_id ON tickets(tier_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_owner_event ON tickets(owner_user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event_status ON tickets(event_id, status);

-- Ticket tiers indexes
CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event_id ON ticket_tiers(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_tiers_status ON ticket_tiers(status);
CREATE INDEX IF NOT EXISTS idx_ticket_tiers_price_cents ON ticket_tiers(price_cents);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);

-- Order items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_tier_id ON order_items(tier_id);

-- Event posts indexes
CREATE INDEX IF NOT EXISTS idx_event_posts_event_id ON event_posts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_posts_author_user_id ON event_posts(author_user_id);
CREATE INDEX IF NOT EXISTS idx_event_posts_tier_id ON event_posts(tier_id);
CREATE INDEX IF NOT EXISTS idx_event_posts_created_at ON event_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_event_posts_event_author ON event_posts(event_id, author_user_id);

-- Event reactions indexes
CREATE INDEX IF NOT EXISTS idx_event_reactions_post_id ON event_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_event_reactions_user_id ON event_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_event_reactions_kind ON event_reactions(kind);
CREATE INDEX IF NOT EXISTS idx_event_reactions_user_post ON event_reactions(user_id, post_id);

-- Ticket scans indexes
CREATE INDEX IF NOT EXISTS idx_ticket_scans_event_id ON ticket_scans(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_ticket_id ON ticket_scans(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_scanned_at ON ticket_scans(scanned_at);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_event_scanned ON ticket_scans(event_id, scanned_at);

-- Organizations indexes
CREATE INDEX IF NOT EXISTS idx_organizations_handle ON organizations(handle);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

-- Organization memberships indexes
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_id ON org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_id ON org_memberships(org_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_role ON org_memberships(role);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user_org ON org_memberships(user_id, org_id);

-- Payouts indexes
CREATE INDEX IF NOT EXISTS idx_payouts_organizer_id ON payouts(organizer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_event_id ON payouts(event_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_created_at ON payouts(created_at);

-- Cultural guides indexes
CREATE INDEX IF NOT EXISTS idx_cultural_guides_event_id ON cultural_guides(event_id);

-- Analytics indexes (updated to match actual table structure)
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_ticket_id ON ticket_analytics(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_user_id ON ticket_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_event_id ON ticket_analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_event_type ON ticket_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_created_at ON ticket_analytics(created_at);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_events_public_upcoming ON events(visibility, start_at) WHERE visibility = 'public' AND start_at > NOW();
CREATE INDEX IF NOT EXISTS idx_tickets_active ON tickets(owner_user_id, status) WHERE status IN ('issued', 'transferred');
CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders(user_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_event_posts_recent ON event_posts(event_id, created_at) WHERE created_at > NOW() - INTERVAL '30 days';

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_events_search ON events USING gin(to_tsvector('english', title || ' ' || description));
CREATE INDEX IF NOT EXISTS idx_user_profiles_search ON user_profiles USING gin(to_tsvector('english', display_name));
CREATE INDEX IF NOT EXISTS idx_organizations_search ON organizations USING gin(to_tsvector('english', name || ' ' || description));

-- Partial indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_published ON events(start_at) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_tickets_issued ON tickets(created_at) WHERE status = 'issued';
CREATE INDEX IF NOT EXISTS idx_orders_paid ON orders(paid_at) WHERE status = 'paid';

-- Statistics update to help query planner
ANALYZE;
