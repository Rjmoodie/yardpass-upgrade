-- Add missing foreign key constraints to fix relationships
-- These constraints will help fix the "Could not find a relationship" errors

-- Add foreign keys for event_posts table  
ALTER TABLE public.event_posts
ADD CONSTRAINT fk_event_posts_event_id 
FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Add foreign keys for tickets table
ALTER TABLE public.tickets
ADD CONSTRAINT fk_tickets_event_id 
FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.tickets
ADD CONSTRAINT fk_tickets_tier_id 
FOREIGN KEY (tier_id) REFERENCES public.ticket_tiers(id) ON DELETE CASCADE;

-- Add foreign keys for orders table
ALTER TABLE public.orders
ADD CONSTRAINT fk_orders_event_id 
FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Add foreign keys for org_memberships table
ALTER TABLE public.org_memberships
ADD CONSTRAINT fk_org_memberships_org_id 
FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add foreign keys for ticket_tiers table
ALTER TABLE public.ticket_tiers
ADD CONSTRAINT fk_ticket_tiers_event_id 
FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Add foreign keys for order_items table
ALTER TABLE public.order_items
ADD CONSTRAINT fk_order_items_order_id 
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.order_items
ADD CONSTRAINT fk_order_items_tier_id 
FOREIGN KEY (tier_id) REFERENCES public.ticket_tiers(id) ON DELETE CASCADE;