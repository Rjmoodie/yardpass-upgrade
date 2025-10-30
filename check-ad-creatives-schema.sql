-- Check ad_creatives schema
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'campaigns'
  AND table_name = 'ad_creatives'
ORDER BY ordinal_position;


