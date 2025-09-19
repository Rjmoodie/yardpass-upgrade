-- Add social links and description to organizations table
ALTER TABLE public.organizations 
ADD COLUMN description TEXT,
ADD COLUMN social_links JSONB DEFAULT '[]'::jsonb;

-- Add index for social links queries
CREATE INDEX IF NOT EXISTS idx_organizations_social_links ON public.organizations USING GIN (social_links);

-- Add comments for documentation
COMMENT ON COLUMN public.organizations.description IS 'Organization description/bio';
COMMENT ON COLUMN public.organizations.social_links IS 'Array of social media links with platform, url, and is_primary fields';