-- Finalize Schema Consistency
-- This migration ensures all code references work correctly with the database

-- ===============================================
-- 1. VERIFY AND FIX ANY REMAINING INCONSISTENCIES
-- ===============================================

-- Ensure all tables have proper RLS policies
DO $$
DECLARE
    table_name TEXT;
    tables_to_check TEXT[] := ARRAY[
        'ticket_analytics',
        'user_profiles', 
        'events',
        'tickets',
        'ticket_tiers',
        'orders',
        'order_items',
        'event_posts',
        'event_comments',
        'event_reactions',
        'organizations',
        'org_memberships'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_to_check
    LOOP
        -- Check if table exists and has RLS enabled
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name AND table_schema = 'public') THEN
            -- Enable RLS if not already enabled
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        END IF;
    END LOOP;
END $$;

-- ===============================================
-- 2. CREATE MISSING RLS POLICIES
-- ===============================================

-- User profiles policies
DO $$
BEGIN
    -- Users can view their own profile
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can view own profile') THEN
        CREATE POLICY "Users can view own profile" ON public.user_profiles
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    -- Users can update their own profile
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can update own profile') THEN
        CREATE POLICY "Users can update own profile" ON public.user_profiles
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    
    -- Users can insert their own profile
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can insert own profile') THEN
        CREATE POLICY "Users can insert own profile" ON public.user_profiles
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Events policies
DO $$
BEGIN
    -- Public events are viewable by everyone
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Public events are viewable by everyone') THEN
        CREATE POLICY "Public events are viewable by everyone" ON public.events
            FOR SELECT USING (visibility = 'public');
    END IF;
    
    -- Event creators can manage their events
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Event creators can manage their events') THEN
        CREATE POLICY "Event creators can manage their events" ON public.events
            FOR ALL USING (auth.uid() = created_by);
    END IF;
END $$;

-- Tickets policies
DO $$
BEGIN
    -- Users can view their own tickets
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'Users can view own tickets') THEN
        CREATE POLICY "Users can view own tickets" ON public.tickets
            FOR SELECT USING (auth.uid() = owner_user_id);
    END IF;
    
    -- Event organizers can view tickets for their events
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tickets' AND policyname = 'Organizers can view event tickets') THEN
        CREATE POLICY "Organizers can view event tickets" ON public.tickets
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.events 
                    WHERE events.id = tickets.event_id 
                    AND events.created_by = auth.uid()
                )
            );
    END IF;
END $$;

-- Event posts policies
DO $$
BEGIN
    -- Everyone can view event posts for public events
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_posts' AND policyname = 'Everyone can view event posts') THEN
        CREATE POLICY "Everyone can view event posts" ON public.event_posts
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.events 
                    WHERE events.id = event_posts.event_id 
                    AND events.visibility = 'public'
                )
            );
    END IF;
    
    -- Authenticated users can create posts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_posts' AND policyname = 'Authenticated users can create posts') THEN
        CREATE POLICY "Authenticated users can create posts" ON public.event_posts
            FOR INSERT WITH CHECK (auth.uid() = author_user_id);
    END IF;
    
    -- Users can update their own posts
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_posts' AND policyname = 'Users can update own posts') THEN
        CREATE POLICY "Users can update own posts" ON public.event_posts
            FOR UPDATE USING (auth.uid() = author_user_id);
    END IF;
END $$;

-- ===============================================
-- 3. CREATE HELPFUL FUNCTIONS
-- ===============================================

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role 
        FROM public.user_profiles 
        WHERE user_profiles.user_id = get_user_role.user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is organizer
CREATE OR REPLACE FUNCTION public.is_organizer(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.get_user_role(user_id) = 'organizer';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get event organizer
CREATE OR REPLACE FUNCTION public.get_event_organizer(event_id UUID)
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT created_by 
        FROM public.events 
        WHERE events.id = get_event_organizer.event_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can manage event
CREATE OR REPLACE FUNCTION public.can_manage_event(event_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.get_event_organizer(event_id) = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===============================================
-- 4. CREATE TRIGGERS FOR DATA CONSISTENCY
-- ===============================================

-- Trigger to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (user_id, display_name, role, verification_status)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'User'),
        'attendee',
        'none'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
END $$;

-- ===============================================
-- 5. CREATE MATERIALIZED VIEWS FOR PERFORMANCE
-- ===============================================

-- Refresh the existing materialized view
REFRESH MATERIALIZED VIEW public.event_video_kpis_daily;

-- Create additional materialized views for common queries
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_ticket_summary AS
SELECT 
    t.owner_user_id,
    COUNT(*) as total_tickets,
    COUNT(*) FILTER (WHERE t.status = 'issued') as active_tickets,
    COUNT(*) FILTER (WHERE t.status = 'redeemed') as used_tickets,
    COUNT(DISTINCT t.event_id) as events_attended,
    SUM(tt.price_cents) / 100.0 as total_spent
FROM public.tickets t
JOIN public.ticket_tiers tt ON tt.id = t.tier_id
GROUP BY t.owner_user_id;

-- Create index on the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_ticket_summary_user_id ON public.user_ticket_summary(owner_user_id);

-- ===============================================
-- 6. GRANT PERMISSIONS
-- ===============================================

-- Grant permissions for the new functions
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organizer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_organizer(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_event(UUID, UUID) TO authenticated;

-- Grant permissions for the materialized view
GRANT SELECT ON public.user_ticket_summary TO authenticated;

-- ===============================================
-- 7. UPDATE EXISTING DATA
-- ===============================================

-- Ensure all existing users have profiles
INSERT INTO public.user_profiles (user_id, display_name, role, verification_status)
SELECT 
    au.id,
    COALESCE(au.raw_user_meta_data->>'display_name', 'User'),
    'attendee',
    'none'
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.user_id = au.id
WHERE up.user_id IS NULL;

-- ===============================================
-- MIGRATION COMPLETE
-- ===============================================

-- Log the completion
INSERT INTO public.kv_store_d42c04e8 (key, value) 
VALUES ('schema_consistency_finalized', jsonb_build_object(
    'timestamp', now(),
    'version', '20250101000003',
    'description', 'Finalized schema consistency and added helper functions'
)) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
