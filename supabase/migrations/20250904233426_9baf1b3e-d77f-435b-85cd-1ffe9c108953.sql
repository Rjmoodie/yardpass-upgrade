-- Fix infinite recursion in org_memberships table
-- First, drop the problematic RLS policies that cause infinite recursion
DROP POLICY IF EXISTS "org_memberships_read_self" ON public.org_memberships;
DROP POLICY IF EXISTS "org_memberships_write_admin" ON public.org_memberships;

-- Create security definer functions to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.get_current_user_org_role(p_org_id uuid)
RETURNS text AS $$
  SELECT m.role::text
  FROM public.org_memberships m
  WHERE m.org_id = p_org_id
    AND m.user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_current_user_org_admin(p_org_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_memberships m
    WHERE m.org_id = p_org_id
      AND m.user_id = auth.uid()
      AND m.role::text = ANY (ARRAY['admin'::text, 'owner'::text])
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Recreate RLS policies without infinite recursion
CREATE POLICY "org_memberships_read_self_fixed" ON public.org_memberships
  FOR SELECT 
  USING (user_id = auth.uid() OR public.is_current_user_org_admin(org_id));

CREATE POLICY "org_memberships_write_admin_fixed" ON public.org_memberships
  FOR ALL 
  USING (public.is_current_user_org_admin(org_id))
  WITH CHECK (public.is_current_user_org_admin(org_id));

-- Fix the is_org_role function to prevent infinite recursion
DROP FUNCTION IF EXISTS public.is_org_role(uuid, text[]);
CREATE OR REPLACE FUNCTION public.is_org_role(p_org_id uuid, p_roles text[])
RETURNS boolean AS $$
  SELECT public.get_current_user_org_role(p_org_id) = ANY(p_roles);
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

-- Add missing foreign key constraints to fix relationships
-- Add foreign keys for events table
ALTER TABLE public.events 
ADD CONSTRAINT fk_events_created_by 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add foreign keys for event_posts table  
ALTER TABLE public.event_posts
ADD CONSTRAINT fk_event_posts_author_user_id 
FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.event_posts
ADD CONSTRAINT fk_event_posts_event_id 
FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Add foreign keys for tickets table
ALTER TABLE public.tickets
ADD CONSTRAINT fk_tickets_owner_user_id 
FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.tickets
ADD CONSTRAINT fk_tickets_event_id 
FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE public.tickets
ADD CONSTRAINT fk_tickets_tier_id 
FOREIGN KEY (tier_id) REFERENCES public.ticket_tiers(id) ON DELETE CASCADE;

-- Add foreign keys for orders table
ALTER TABLE public.orders
ADD CONSTRAINT fk_orders_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.orders
ADD CONSTRAINT fk_orders_event_id 
FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

-- Add foreign keys for org_memberships table
ALTER TABLE public.org_memberships
ADD CONSTRAINT fk_org_memberships_user_id 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.org_memberships
ADD CONSTRAINT fk_org_memberships_org_id 
FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add foreign keys for organizations table
ALTER TABLE public.organizations
ADD CONSTRAINT fk_organizations_created_by 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;