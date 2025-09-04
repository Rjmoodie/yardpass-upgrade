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

-- Update the is_org_role function to prevent infinite recursion (don't drop first)
CREATE OR REPLACE FUNCTION public.is_org_role(p_org_id uuid, p_roles text[])
RETURNS boolean AS $$
  SELECT public.get_current_user_org_role(p_org_id) = ANY(p_roles);
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;