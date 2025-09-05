-- Fix Schema Inconsistencies
-- This migration addresses the gaps between our code and the current schema

-- ===============================================
-- 1. CREATE MISSING TICKET_ANALYTICS TABLE
-- ===============================================

-- Create the ticket_analytics table that our code references
CREATE TABLE IF NOT EXISTS public.ticket_analytics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL CHECK (event_type IN ('ticket_view', 'qr_code_view', 'ticket_share', 'ticket_copy', 'wallet_download')),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for ticket_analytics
ALTER TABLE public.ticket_analytics ENABLE ROW LEVEL SECURITY;

-- ===============================================
-- 2. FIX USER_PROFILES.ROLE FIELD CONSTRAINTS
-- ===============================================

-- Add proper constraint to user_profiles.role field
ALTER TABLE public.user_profiles 
ADD CONSTRAINT check_role_valid 
CHECK (role IN ('attendee', 'organizer'));

-- ===============================================
-- 3. ADD MISSING FIELDS AND CONSTRAINTS
-- ===============================================

-- Add missing fields to user_profiles if they don't exist
DO $$ 
BEGIN
    -- Add updated_at field if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_profiles' AND column_name = 'updated_at') THEN
        ALTER TABLE public.user_profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;
END $$;

-- Add trigger to automatically update updated_at field
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for user_profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_profiles_updated_at') THEN
        CREATE TRIGGER update_user_profiles_updated_at
            BEFORE UPDATE ON public.user_profiles
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ===============================================
-- 4. ADD MISSING INDEXES FOR PERFORMANCE
-- ===============================================

-- Indexes for ticket_analytics table
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_ticket_id ON public.ticket_analytics(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_event_id ON public.ticket_analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_user_id ON public.ticket_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_event_type ON public.ticket_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_created_at ON public.ticket_analytics(created_at);

-- Indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_verification_status ON public.user_profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON public.user_profiles(updated_at);

-- ===============================================
-- 5. ADD RLS POLICIES FOR TICKET_ANALYTICS
-- ===============================================

-- Users can insert their own ticket analytics
CREATE POLICY "Users can insert their own ticket analytics" ON public.ticket_analytics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own ticket analytics
CREATE POLICY "Users can view their own ticket analytics" ON public.ticket_analytics
    FOR SELECT USING (auth.uid() = user_id);

-- Event organizers can view analytics for their events
CREATE POLICY "Organizers can view event ticket analytics" ON public.ticket_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.events 
            WHERE events.id = ticket_analytics.event_id 
            AND events.created_by = auth.uid()
        )
    );

-- ===============================================
-- 6. FIX FIELD REFERENCES IN EXISTING TABLES
-- ===============================================

-- Ensure ticket_tiers has proper badge field (some code references 'badge' instead of 'badge_label')
-- Add a computed column or view if needed
DO $$
BEGIN
    -- Add badge column as alias to badge_label if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_tiers' AND column_name = 'badge') THEN
        ALTER TABLE public.ticket_tiers ADD COLUMN badge TEXT GENERATED ALWAYS AS (badge_label) STORED;
    END IF;
END $$;

-- ===============================================
-- 7. ADD MISSING CONSTRAINTS
-- ===============================================

-- Add constraint to ensure ticket_tiers has valid status
ALTER TABLE public.ticket_tiers 
ADD CONSTRAINT check_ticket_tier_status_valid 
CHECK (status IN ('active', 'inactive', 'sold_out', 'cancelled'));

-- Add constraint to ensure orders have valid currency
ALTER TABLE public.orders 
ADD CONSTRAINT check_currency_valid 
CHECK (currency IN ('USD', 'EUR', 'GBP', 'CAD'));

-- ===============================================
-- 8. CREATE HELPFUL VIEWS
-- ===============================================

-- Create a view for ticket analytics summary
CREATE OR REPLACE VIEW public.ticket_analytics_summary AS
SELECT 
    event_id,
    ticket_id,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE event_type = 'ticket_view') as views,
    COUNT(*) FILTER (WHERE event_type = 'qr_code_view') as qr_views,
    COUNT(*) FILTER (WHERE event_type = 'ticket_share') as shares,
    COUNT(*) FILTER (WHERE event_type = 'ticket_copy') as copies,
    COUNT(*) FILTER (WHERE event_type = 'wallet_download') as wallet_downloads,
    MIN(created_at) as first_event,
    MAX(created_at) as last_event
FROM public.ticket_analytics
GROUP BY event_id, ticket_id;

-- Create a view for user profile with computed fields
CREATE OR REPLACE VIEW public.user_profiles_enhanced AS
SELECT 
    up.*,
    CASE 
        WHEN up.verification_status = 'pro' THEN 'Pro Organizer'
        WHEN up.verification_status = 'verified' THEN 'Verified'
        WHEN up.role = 'organizer' THEN 'Organizer'
        ELSE 'Attendee'
    END as display_role,
    EXTRACT(EPOCH FROM (now() - up.created_at)) / 86400 as days_since_joined
FROM public.user_profiles up;

-- ===============================================
-- 9. UPDATE EXISTING DATA
-- ===============================================

-- Update any existing user_profiles with invalid role values
UPDATE public.user_profiles 
SET role = 'attendee' 
WHERE role NOT IN ('attendee', 'organizer');

-- Update any existing ticket_tiers with invalid status values
UPDATE public.ticket_tiers 
SET status = 'active' 
WHERE status NOT IN ('active', 'inactive', 'sold_out', 'cancelled');

-- ===============================================
-- 10. GRANT PERMISSIONS
-- ===============================================

-- Grant necessary permissions for the new table and views
GRANT SELECT, INSERT ON public.ticket_analytics TO authenticated;
GRANT SELECT ON public.ticket_analytics_summary TO authenticated;
GRANT SELECT ON public.user_profiles_enhanced TO authenticated;

-- ===============================================
-- MIGRATION COMPLETE
-- ===============================================

-- Log the completion
INSERT INTO public.kv_store_d42c04e8 (key, value) 
VALUES ('schema_fix_migration_completed', jsonb_build_object(
    'timestamp', now(),
    'version', '20250101000001',
    'description', 'Fixed schema inconsistencies between code and database'
)) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
