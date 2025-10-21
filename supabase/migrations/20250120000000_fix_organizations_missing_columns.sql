-- Fix missing columns in organizations table
-- The app is trying to query columns that don't exist

-- Add missing columns to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS support_email text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS banner_url text,
ADD COLUMN IF NOT EXISTS website_url text,
ADD COLUMN IF NOT EXISTS twitter_url text,
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS tiktok_url text,
ADD COLUMN IF NOT EXISTS location text;

-- Update the existing description column if it was added in a previous migration
-- but ensure it has the right type
ALTER TABLE public.organizations 
ALTER COLUMN description TYPE text;

-- Ensure social_links is properly formatted as JSON array
UPDATE public.organizations 
SET social_links = '[]'::jsonb 
WHERE social_links IS NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organizations_support_email ON public.organizations(support_email);
CREATE INDEX IF NOT EXISTS idx_organizations_handle ON public.organizations(handle);

-- Update RLS policies to include new columns
-- The existing policies should work, but let's ensure they're comprehensive
DROP POLICY IF EXISTS orgs_read_all ON public.organizations;
CREATE POLICY orgs_read_all ON public.organizations 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS orgs_insert_auth ON public.organizations;
CREATE POLICY orgs_insert_auth ON public.organizations 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS orgs_update_admin ON public.organizations;
CREATE POLICY orgs_update_admin ON public.organizations 
  FOR UPDATE
  USING (public.is_org_role(id, array['admin','owner']))
  WITH CHECK (public.is_org_role(id, array['admin','owner']));

DROP POLICY IF EXISTS orgs_delete_owner ON public.organizations;
CREATE POLICY orgs_delete_owner ON public.organizations 
  FOR DELETE USING (public.is_org_role(id, array['owner']));
