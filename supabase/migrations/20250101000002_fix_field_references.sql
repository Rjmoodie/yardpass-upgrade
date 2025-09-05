-- Fix Field References and Code Consistency
-- This migration ensures all field references in our code match the database schema

-- ===============================================
-- 1. FIX TICKET_TIERS FIELD REFERENCES
-- ===============================================

-- Ensure badge_label is properly populated from name if empty
UPDATE public.ticket_tiers 
SET badge_label = name 
WHERE badge_label IS NULL OR badge_label = '';

-- ===============================================
-- 2. ADD MISSING COMPUTED FIELDS
-- ===============================================

-- Add computed fields that our code expects
DO $$
BEGIN
    -- Add price field as computed from price_cents
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_tiers' AND column_name = 'price') THEN
        ALTER TABLE public.ticket_tiers 
        ADD COLUMN price DECIMAL(10,2) GENERATED ALWAYS AS (price_cents / 100.0) STORED;
    END IF;
    
    -- Add available field as computed from quantity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_tiers' AND column_name = 'available') THEN
        ALTER TABLE public.ticket_tiers 
        ADD COLUMN available INTEGER GENERATED ALWAYS AS (
            CASE 
                WHEN quantity IS NULL THEN NULL
                ELSE quantity - COALESCE((
                    SELECT SUM(oi.quantity) 
                    FROM public.order_items oi 
                    JOIN public.orders o ON o.id = oi.order_id 
                    WHERE oi.tier_id = ticket_tiers.id 
                    AND o.status = 'paid'
                ), 0)
            END
        ) STORED;
    END IF;
    
    -- Add total field as alias to quantity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'ticket_tiers' AND column_name = 'total') THEN
        ALTER TABLE public.ticket_tiers 
        ADD COLUMN total INTEGER GENERATED ALWAYS AS (quantity) STORED;
    END IF;
END $$;

-- ===============================================
-- 3. ADD MISSING EVENT FIELDS
-- ===============================================

-- Add fields that our code might expect
DO $$
BEGIN
    -- Add attendee_count as computed field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'attendee_count') THEN
        ALTER TABLE public.events 
        ADD COLUMN attendee_count INTEGER GENERATED ALWAYS AS (
            COALESCE((
                SELECT COUNT(DISTINCT t.owner_user_id) 
                FROM public.tickets t 
                WHERE t.event_id = events.id 
                AND t.status = 'issued'
            ), 0)
        ) STORED;
    END IF;
    
    -- Add likes count as computed field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'likes') THEN
        ALTER TABLE public.events 
        ADD COLUMN likes INTEGER GENERATED ALWAYS AS (
            COALESCE((
                SELECT COUNT(*) 
                FROM public.event_reactions er
                JOIN public.event_posts ep ON ep.id = er.post_id
                WHERE ep.event_id = events.id 
                AND er.kind = 'like'
            ), 0)
        ) STORED;
    END IF;
    
    -- Add shares count as computed field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'shares') THEN
        ALTER TABLE public.events 
        ADD COLUMN shares INTEGER GENERATED ALWAYS AS (
            COALESCE((
                SELECT COUNT(*) 
                FROM public.event_reactions er
                JOIN public.event_posts ep ON ep.id = er.post_id
                WHERE ep.event_id = events.id 
                AND er.kind = 'share'
            ), 0)
        ) STORED;
    END IF;
END $$;

-- ===============================================
-- 4. ADD MISSING TICKET FIELDS
-- ===============================================

-- Add fields that our TicketsPage component expects
DO $$
BEGIN
    -- Add event_title as computed field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tickets' AND column_name = 'event_title') THEN
        ALTER TABLE public.tickets 
        ADD COLUMN event_title TEXT GENERATED ALWAYS AS (
            (SELECT e.title FROM public.events e WHERE e.id = tickets.event_id)
        ) STORED;
    END IF;
    
    -- Add event_date as computed field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tickets' AND column_name = 'event_date') THEN
        ALTER TABLE public.tickets 
        ADD COLUMN event_date TEXT GENERATED ALWAYS AS (
            (SELECT TO_CHAR(e.start_at, 'MMM DD, YYYY') FROM public.events e WHERE e.id = tickets.event_id)
        ) STORED;
    END IF;
    
    -- Add event_time as computed field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tickets' AND column_name = 'event_time') THEN
        ALTER TABLE public.tickets 
        ADD COLUMN event_time TEXT GENERATED ALWAYS AS (
            (SELECT TO_CHAR(e.start_at, 'HH:MM AM') FROM public.events e WHERE e.id = tickets.event_id)
        ) STORED;
    END IF;
    
    -- Add event_location as computed field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tickets' AND column_name = 'event_location') THEN
        ALTER TABLE public.tickets 
        ADD COLUMN event_location TEXT GENERATED ALWAYS AS (
            (SELECT COALESCE(e.venue, e.address, e.city) FROM public.events e WHERE e.id = tickets.event_id)
        ) STORED;
    END IF;
    
    -- Add organizer_name as computed field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tickets' AND column_name = 'organizer_name') THEN
        ALTER TABLE public.tickets 
        ADD COLUMN organizer_name TEXT GENERATED ALWAYS AS (
            (SELECT up.display_name 
             FROM public.events e 
             JOIN public.user_profiles up ON up.user_id = e.created_by 
             WHERE e.id = tickets.event_id)
        ) STORED;
    END IF;
    
    -- Add price as computed field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tickets' AND column_name = 'price') THEN
        ALTER TABLE public.tickets 
        ADD COLUMN price DECIMAL(10,2) GENERATED ALWAYS AS (
            (SELECT tt.price_cents / 100.0 FROM public.ticket_tiers tt WHERE tt.id = tickets.tier_id)
        ) STORED;
    END IF;
    
    -- Add badge as computed field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tickets' AND column_name = 'badge') THEN
        ALTER TABLE public.tickets 
        ADD COLUMN badge TEXT GENERATED ALWAYS AS (
            (SELECT COALESCE(tt.badge_label, tt.name) FROM public.ticket_tiers tt WHERE tt.id = tickets.tier_id)
        ) STORED;
    END IF;
    
    -- Add ticket_type as computed field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tickets' AND column_name = 'ticket_type') THEN
        ALTER TABLE public.tickets 
        ADD COLUMN ticket_type TEXT GENERATED ALWAYS AS (
            (SELECT tt.name FROM public.ticket_tiers tt WHERE tt.id = tickets.tier_id)
        ) STORED;
    END IF;
    
    -- Add order_date as computed field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tickets' AND column_name = 'order_date') THEN
        ALTER TABLE public.tickets 
        ADD COLUMN order_date TIMESTAMP WITH TIME ZONE GENERATED ALWAYS AS (
            (SELECT o.created_at FROM public.orders o WHERE o.id = tickets.order_id)
        ) STORED;
    END IF;
    
    -- Add cover_image as computed field
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tickets' AND column_name = 'cover_image') THEN
        ALTER TABLE public.tickets 
        ADD COLUMN cover_image TEXT GENERATED ALWAYS AS (
            (SELECT e.cover_image_url FROM public.events e WHERE e.id = tickets.event_id)
        ) STORED;
    END IF;
END $$;

-- ===============================================
-- 5. CREATE HELPFUL VIEWS FOR COMPLEX QUERIES
-- ===============================================

-- Create a comprehensive tickets view with all computed fields
CREATE OR REPLACE VIEW public.tickets_enhanced AS
SELECT 
    t.*,
    e.title as event_title,
    TO_CHAR(e.start_at, 'MMM DD, YYYY') as event_date,
    TO_CHAR(e.start_at, 'HH:MM AM') as event_time,
    COALESCE(e.venue, e.address, e.city) as event_location,
    up.display_name as organizer_name,
    tt.price_cents / 100.0 as price,
    COALESCE(tt.badge_label, tt.name) as badge,
    tt.name as ticket_type,
    o.created_at as order_date,
    e.cover_image_url as cover_image
FROM public.tickets t
JOIN public.events e ON e.id = t.event_id
JOIN public.ticket_tiers tt ON tt.id = t.tier_id
LEFT JOIN public.orders o ON o.id = t.order_id
LEFT JOIN public.user_profiles up ON up.user_id = e.created_by;

-- Create a comprehensive events view with all computed fields
CREATE OR REPLACE VIEW public.events_enhanced AS
SELECT 
    e.*,
    COUNT(DISTINCT t.owner_user_id) as attendee_count,
    COUNT(DISTINCT er.id) FILTER (WHERE er.kind = 'like') as likes,
    COUNT(DISTINCT er.id) FILTER (WHERE er.kind = 'share') as shares,
    COUNT(DISTINCT ep.id) as post_count,
    COUNT(DISTINCT tt.id) as tier_count,
    MIN(tt.price_cents) / 100.0 as min_price,
    MAX(tt.price_cents) / 100.0 as max_price
FROM public.events e
LEFT JOIN public.tickets t ON t.event_id = e.id AND t.status = 'issued'
LEFT JOIN public.event_posts ep ON ep.event_id = e.id
LEFT JOIN public.event_reactions er ON er.post_id = ep.id
LEFT JOIN public.ticket_tiers tt ON tt.event_id = e.id
GROUP BY e.id;

-- ===============================================
-- 6. ADD INDEXES FOR PERFORMANCE
-- ===============================================

-- Indexes for the new computed fields
CREATE INDEX IF NOT EXISTS idx_tickets_event_title ON public.tickets(event_title);
CREATE INDEX IF NOT EXISTS idx_tickets_event_date ON public.tickets(event_date);
CREATE INDEX IF NOT EXISTS idx_tickets_organizer_name ON public.tickets(organizer_name);
CREATE INDEX IF NOT EXISTS idx_tickets_price ON public.tickets(price);
CREATE INDEX IF NOT EXISTS idx_tickets_badge ON public.tickets(badge);

CREATE INDEX IF NOT EXISTS idx_events_attendee_count ON public.events(attendee_count);
CREATE INDEX IF NOT EXISTS idx_events_likes ON public.events(likes);
CREATE INDEX IF NOT EXISTS idx_events_shares ON public.events(shares);

-- ===============================================
-- 7. GRANT PERMISSIONS
-- ===============================================

-- Grant permissions for the new views
GRANT SELECT ON public.tickets_enhanced TO authenticated;
GRANT SELECT ON public.events_enhanced TO authenticated;

-- ===============================================
-- MIGRATION COMPLETE
-- ===============================================

-- Log the completion
INSERT INTO public.kv_store_d42c04e8 (key, value) 
VALUES ('field_references_fix_completed', jsonb_build_object(
    'timestamp', now(),
    'version', '20250101000002',
    'description', 'Fixed field references and added computed fields for code consistency'
)) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
