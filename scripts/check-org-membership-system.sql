-- Check Organization Membership System
-- Run this to understand why auto-membership isn't working

-- 1. Check if public.org_memberships view exists
SELECT 
  '=== PUBLIC ORG_MEMBERSHIPS VIEW ===' AS section,
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE viewname = 'org_memberships'
ORDER BY schemaname;

-- 2. Check the actual table structure
SELECT 
  '=== ORGANIZATIONS.ORG_MEMBERSHIPS TABLE ===' AS section,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'organizations'
  AND table_name = 'org_memberships'
ORDER BY ordinal_position;

-- 3. Check your current org and membership status
SELECT 
  '=== YOUR CURRENT STATUS ===' AS section,
  o.id AS org_id,
  o.name AS org_name,
  o.handle,
  o.created_by,
  CASE WHEN o.created_by = auth.uid() THEN '✅ You created this org' ELSE '❌ Not your org' END AS creator_status
FROM organizations.organizations o
WHERE o.created_by = auth.uid()
ORDER BY o.created_at DESC;

-- 4. Check if you have ANY memberships
SELECT 
  '=== YOUR ORG MEMBERSHIPS ===' AS section,
  m.org_id,
  o.name AS org_name,
  m.role,
  m.created_at
FROM organizations.org_memberships m
JOIN organizations.organizations o ON m.org_id = o.id
WHERE m.user_id = auth.uid();

-- 5. Check the create_organization_with_membership function
SELECT 
  '=== FUNCTION DEFINITION ===' AS section,
  routine_name,
  routine_schema,
  security_type,
  pg_get_functiondef((routine_schema || '.' || routine_name || '(' || string_agg(parameter_mode || ' ' || parameter_name || ' ' || udt_name, ', ') || ')')::regprocedure)::text AS full_definition
FROM information_schema.routines r
LEFT JOIN information_schema.parameters p ON r.specific_name = p.specific_name
WHERE routine_name = 'create_organization_with_membership'
GROUP BY routine_name, routine_schema, security_type, r.specific_name;

-- 6. Check if there's a trigger on org creation
SELECT 
  '=== TRIGGERS ON ORGANIZATIONS TABLE ===' AS section,
  trigger_name,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'organizations'
  AND event_object_table = 'organizations';

