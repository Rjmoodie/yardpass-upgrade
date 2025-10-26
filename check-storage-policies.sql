-- Check existing storage buckets
SELECT * FROM storage.buckets WHERE id = 'event-media';

-- Check existing storage policies
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- Check if there are any files in the bucket
SELECT name, bucket_id, created_at 
FROM storage.objects 
WHERE bucket_id = 'event-media' 
LIMIT 10;

