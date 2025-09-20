-- Add new columns to organizations table for enhanced branding
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS banner_url text,
ADD COLUMN IF NOT EXISTS website_url text,
ADD COLUMN IF NOT EXISTS twitter_url text,
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS tiktok_url text,
ADD COLUMN IF NOT EXISTS location text;

-- Create storage bucket for organization media if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('org-media', 'org-media', true, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for organization media bucket
CREATE POLICY "Organization media is publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'org-media');

CREATE POLICY "Organization admins can upload media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'org-media' 
  AND EXISTS (
    SELECT 1 FROM public.org_memberships om
    WHERE om.org_id::text = (storage.foldername(name))[1]
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin', 'editor')
  )
);

CREATE POLICY "Organization admins can update media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'org-media'
  AND EXISTS (
    SELECT 1 FROM public.org_memberships om
    WHERE om.org_id::text = (storage.foldername(name))[1]
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin', 'editor')
  )
);

CREATE POLICY "Organization admins can delete media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'org-media'
  AND EXISTS (
    SELECT 1 FROM public.org_memberships om
    WHERE om.org_id::text = (storage.foldername(name))[1]
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin', 'editor')
  )
);