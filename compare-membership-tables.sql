-- Compare the three membership tables

-- 1. organizations.org_memberships
SELECT 'organizations.org_memberships' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'organizations' 
  AND table_name = 'org_memberships'
ORDER BY ordinal_position;

-- 2. public.org_memberships  
SELECT 'public.org_memberships' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'org_memberships'
ORDER BY ordinal_position;

-- 3. public.org_members (if it exists as a VIEW)
SELECT 'public.org_members' as table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'org_members'
ORDER BY ordinal_position;

-- Check if org_members is a view
SELECT 
  table_schema,
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name IN ('org_memberships', 'org_members')
ORDER BY table_schema, table_name;

