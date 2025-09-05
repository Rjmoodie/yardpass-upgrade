-- Create missing ticket_analytics table
CREATE TABLE IF NOT EXISTS public.ticket_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (event_type IN ('ticket_view', 'qr_code_view', 'ticket_share', 'ticket_copy', 'wallet_download')),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on ticket_analytics
ALTER TABLE public.ticket_analytics ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for ticket_analytics
CREATE POLICY "Users can insert their own analytics" ON public.ticket_analytics
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own analytics" ON public.ticket_analytics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Organizers can view event analytics" ON public.ticket_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.events 
            WHERE events.id = ticket_analytics.event_id 
            AND events.created_by = auth.uid()
        )
    );

-- Add constraints to user_profiles.role
ALTER TABLE public.user_profiles 
ADD CONSTRAINT check_user_role 
CHECK (role IN ('attendee', 'organizer'));

-- Add constraints to ticket_tiers.status
ALTER TABLE public.ticket_tiers 
ADD CONSTRAINT check_tier_status 
CHECK (status IN ('active', 'inactive', 'sold_out'));

-- Add constraints to orders.currency
ALTER TABLE public.orders 
ADD CONSTRAINT check_currency 
CHECK (currency IN ('USD', 'EUR', 'GBP', 'CAD'));

-- Create enhanced views with proper relationships
CREATE OR REPLACE VIEW public.tickets_enhanced AS
SELECT 
    t.*,
    e.title as event_title,
    e.start_at as event_date,
    e.start_at::time as event_time,
    e.venue as event_location,
    up.display_name as organizer_name,
    tt.price_cents / 100.0 as price,
    tt.badge_label as badge,
    tt.name as ticket_type,
    o.created_at as order_date,
    e.cover_image_url as cover_image
FROM public.tickets t
JOIN public.events e ON e.id = t.event_id
JOIN public.ticket_tiers tt ON tt.id = t.tier_id
LEFT JOIN public.orders o ON o.id = t.order_id
LEFT JOIN public.user_profiles up ON up.user_id = e.created_by;

CREATE OR REPLACE VIEW public.events_enhanced AS
SELECT 
    e.*,
    COUNT(DISTINCT t.owner_user_id) as attendee_count,
    COUNT(DISTINCT er.user_id) FILTER (WHERE er.kind = 'like') as likes,
    COUNT(DISTINCT er.user_id) FILTER (WHERE er.kind = 'share') as shares,
    COUNT(DISTINCT ep.id) as post_count,
    COUNT(DISTINCT tt.id) as tier_count,
    MIN(tt.price_cents) as min_price,
    MAX(tt.price_cents) as max_price
FROM public.events e
LEFT JOIN public.tickets t ON t.event_id = e.id
LEFT JOIN public.event_posts ep ON ep.event_id = e.id
LEFT JOIN public.event_reactions er ON er.post_id = ep.id
LEFT JOIN public.ticket_tiers tt ON tt.event_id = e.id
GROUP BY e.id;

-- Add proper foreign key relationships
ALTER TABLE public.event_reactions 
ADD CONSTRAINT fk_event_reactions_post_id 
FOREIGN KEY (post_id) REFERENCES public.event_posts(id) ON DELETE CASCADE;

ALTER TABLE public.event_reactions 
ADD CONSTRAINT fk_event_reactions_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.event_posts 
ADD CONSTRAINT fk_event_posts_ticket_tier_id 
FOREIGN KEY (ticket_tier_id) REFERENCES public.ticket_tiers(id) ON DELETE SET NULL;

ALTER TABLE public.event_posts 
ADD CONSTRAINT fk_event_posts_author_user_id 
FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.event_comments 
ADD CONSTRAINT fk_event_comments_post_id 
FOREIGN KEY (post_id) REFERENCES public.event_posts(id) ON DELETE CASCADE;

ALTER TABLE public.event_comments 
ADD CONSTRAINT fk_event_comments_author_user_id 
FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_event_type ON public.ticket_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_ticket_id ON public.ticket_analytics(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_event_id ON public.ticket_analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_user_id ON public.ticket_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_created_at ON public.ticket_analytics(created_at);

CREATE INDEX IF NOT EXISTS idx_event_reactions_post_id ON public.event_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_event_reactions_user_id ON public.event_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_event_posts_event_id ON public.event_posts(event_id);
CREATE INDEX IF NOT EXISTS idx_event_posts_author_user_id ON public.event_posts(author_user_id);
CREATE INDEX IF NOT EXISTS idx_event_comments_post_id ON public.event_comments(post_id);

-- Grant permissions
GRANT SELECT ON public.tickets_enhanced TO authenticated;
GRANT SELECT ON public.events_enhanced TO authenticated;
GRANT ALL ON public.ticket_analytics TO authenticated;