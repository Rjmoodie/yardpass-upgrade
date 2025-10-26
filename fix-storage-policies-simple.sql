-- Fix storage policies for event-media bucket (simple, non-recursive version)
-- This avoids infinite recursion by using only auth.uid() checks

-- Drop all existing policies on storage.objects for event-media bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to event-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to event-media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload event media" ON storage.objects;

-- 1. Public read access - anyone can view files
CREATE POLICY "Public read access to event-media"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'event-media');

-- 2. Authenticated users can upload to their own folder {user_id}/
CREATE POLICY "Authenticated users can upload to event-media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Users can update their own files
CREATE POLICY "Authenticated users can update their own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'event-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Users can delete their own files
CREATE POLICY "Authenticated users can delete their own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
ORDER BY policyname;

