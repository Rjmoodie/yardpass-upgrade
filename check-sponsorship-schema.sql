-- Check the foreign key constraint
SELECT 
  tc.table_schema, 
  tc.table_name, 
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name = 'sponsorship_orders'
AND kcu.column_name = 'sponsor_id';

-- Check if sponsors exist in sponsorship schema
SELECT 'public.sponsors' as location, COUNT(*) FROM public.sponsors
UNION ALL
SELECT 'sponsorship.sponsors', COUNT(*) FROM sponsorship.sponsors;

