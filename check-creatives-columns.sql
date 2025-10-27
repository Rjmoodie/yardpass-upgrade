-- Check ad_creatives columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'campaigns' 
  AND table_name = 'ad_creatives'
ORDER BY ordinal_position;

