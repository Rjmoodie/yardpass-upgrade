-- =====================================================
-- COMPLETE: Create Sponsors + Sponsored Event
-- =====================================================

-- STEP 1: Create sponsors (if they don't exist)
-- =====================================================
INSERT INTO public.sponsors (
  id, 
  name, 
  logo_url, 
  website_url, 
  description,
  industry,
  company_size
)
VALUES
  (
    '00000000-0000-0000-0000-000000000001'::uuid, 
    'TechCorp Industries', 
    'https://api.dicebear.com/7.x/initials/svg?seed=TC&backgroundColor=0ea5e9', 
    'https://techcorp.example.com',
    'Leading technology solutions for enterprise clients',
    'Technology',
    'enterprise'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  logo_url = EXCLUDED.logo_url;

-- Verify sponsor exists
SELECT 'Sponsor Created' as status, id, name FROM sponsors WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

-- STEP 2: Create sponsored event
-- =====================================================
DO $$
DECLARE
  v_event_id uuid;
  v_sponsor_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
  v_package_id uuid;
BEGIN
  -- Get first event
  SELECT id INTO v_event_id FROM events LIMIT 1;
  
  RAISE NOTICE 'Creating sponsorship for event: %', v_event_id;
  
  -- Create Gold package
  INSERT INTO sponsorship.sponsorship_packages (
    event_id,
    title,
    tier,
    price_cents,
    currency,
    inventory,
    sold,
    benefits,
    visibility,
    is_active
  )
  VALUES (
    v_event_id,
    'Gold Sponsorship',
    'Gold',
    500000,
    'USD',
    2,
    1,
    '{"logo_placement": "prominent", "speaking_slot": true}'::jsonb,
    'public',
    true
  )
  RETURNING id INTO v_package_id;
  
  RAISE NOTICE 'Package created: %', v_package_id;
  
  -- Create active sponsorship order
  INSERT INTO sponsorship.sponsorship_orders (
    package_id,
    sponsor_id,
    event_id,
    amount_cents,
    status
  )
  VALUES (
    v_package_id,
    v_sponsor_id,
    v_event_id,
    500000,
    'live'
  );
  
  RAISE NOTICE '✅ SUCCESS! Event is now sponsored!';
  
END $$;

-- STEP 3: Verify the sponsorship
-- =====================================================
SELECT 
  e.id as event_id,
  e.title as event_name,
  s.name as sponsor_name,
  sp.tier,
  so.status,
  '$' || (so.amount_cents / 100)::text as amount
FROM sponsorship.sponsorship_orders so
JOIN sponsors s ON s.id = so.sponsor_id
JOIN events e ON e.id = so.event_id
JOIN sponsorship.sponsorship_packages sp ON sp.id = so.package_id
WHERE so.status = 'live'
ORDER BY so.created_at DESC;

