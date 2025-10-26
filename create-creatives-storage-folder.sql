-- Enable storage on the event-media bucket if not already done
-- This allows uploading to subfolders

-- Create RLS policy for creatives folder
INSERT INTO storage.objects (bucket_id, name, owner, owner_id)
VALUES ('event-media', 'creatives/.keep', NULL, NULL)
ON CONFLICT DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated uploads to creatives" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to creatives" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update creatives" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete creatives" ON storage.objects;

-- Policy: Allow authenticated users to upload to creatives folder
CREATE POLICY "Allow authenticated uploads to creatives"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-media' AND (storage.foldername(name))[1] = 'creatives');

-- Policy: Allow public read access to creatives
CREATE POLICY "Public read access to creatives"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'event-media' AND (storage.foldername(name))[1] = 'creatives');

-- Policy: Allow authenticated users to update their own creative uploads
CREATE POLICY "Allow authenticated users to update creatives"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-media' AND (storage.foldername(name))[1] = 'creatives');

-- Policy: Allow authenticated users to delete their own creative uploads
CREATE POLICY "Allow authenticated users to delete creatives"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-media' AND (storage.foldername(name))[1] = 'creatives');
