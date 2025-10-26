-- Drop the storage policies for org-media that are causing infinite recursion
-- These policies query org_memberships, creating a circular dependency

DROP POLICY IF EXISTS "Organization admins can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Organization admins can update media" ON storage.objects;
DROP POLICY IF EXISTS "Organization admins can delete media" ON storage.objects;

-- Verify they're gone
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%Organization admins%'
ORDER BY policyname;

