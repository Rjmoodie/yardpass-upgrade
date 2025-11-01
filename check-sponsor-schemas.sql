-- Check columns in both sponsor tables
SELECT 
  'public.sponsors' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'sponsors'
ORDER BY ordinal_position;

SELECT 
  'sponsorship.sponsors' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'sponsorship' AND table_name = 'sponsors'
ORDER BY ordinal_position;

