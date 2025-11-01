-- Check the FK constraint on sponsorship_orders
SELECT 
  tc.constraint_name,
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'sponsorship'
AND tc.table_name = 'sponsorship_orders'
AND kcu.column_name = 'sponsor_id';

-- Check where sponsors actually exist
SELECT 'public.sponsors' as table_location, COUNT(*) as count 
FROM public.sponsors;

-- Try selecting from sponsorship.sponsors
SELECT 'sponsorship.sponsors' as table_location, COUNT(*) as count 
FROM sponsorship.sponsors;

