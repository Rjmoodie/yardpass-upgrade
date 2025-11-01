-- Verify the sponsorship exists for Tech Conference 2024
SELECT 
  'Direct query of sponsorship_orders' as check_type,
  so.*
FROM sponsorship.sponsorship_orders so
WHERE so.event_id = '41cc320a-c01e-4425-af32-86452e7466e5'::uuid;

-- Check via the public view (what the component uses)
SELECT 
  'Via public.sponsorship_orders view' as check_type,
  so.*
FROM public.sponsorship_orders so
WHERE so.event_id = '41cc320a-c01e-4425-af32-86452e7466e5'::uuid;

-- Full join to see all related data
SELECT 
  'Full sponsorship data' as check_type,
  so.id,
  so.event_id,
  so.sponsor_id,
  so.status,
  s.name as sponsor_name,
  s.logo_url,
  sp.tier
FROM sponsorship.sponsorship_orders so
LEFT JOIN sponsorship.sponsors s ON s.id = so.sponsor_id
LEFT JOIN sponsorship.sponsorship_packages sp ON sp.id = so.package_id
WHERE so.event_id = '41cc320a-c01e-4425-af32-86452e7466e5'::uuid;

