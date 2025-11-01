-- =====================================================
-- CREATE SPONSORED EVENT - Using Existing Sponsors
-- =====================================================

-- 1. Check what sponsors we have
SELECT id, name FROM sponsors LIMIT 5;

-- 2. Create sponsored event using FIRST AVAILABLE sponsor
DO $$
DECLARE
  v_event_id uuid;
  v_sponsor_id uuid;
  v_package_id uuid;
  v_sponsor_name text;
BEGIN
  -- Get first event
  SELECT id INTO v_event_id FROM events LIMIT 1;
  
  -- Get FIRST sponsor (whatever exists)
  SELECT id, name INTO v_sponsor_id, v_sponsor_name FROM sponsors LIMIT 1;
  
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'No events found';
  END IF;
  
  IF v_sponsor_id IS NULL THEN
    RAISE EXCEPTION 'No sponsors found';
  END IF;
  
  RAISE NOTICE 'Event ID: %', v_event_id;
  RAISE NOTICE 'Sponsor: % (%)', v_sponsor_name, v_sponsor_id;
  
  -- Create a Gold package
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
    'Gold Sponsorship - Premium',
    'Gold',
    500000, -- $5,000
    'USD',
    2,
    1, -- Mark 1 as sold
    '{"logo_placement": "prominent", "speaking_slot": true, "booth_space": "premium"}'::jsonb,
    'public',
    true
  )
  RETURNING id INTO v_package_id;
  
  RAISE NOTICE 'Package ID: %', v_package_id;
  
  -- Create sponsorship order
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
    'live' -- Active!
  );
  
  RAISE NOTICE '✅ SPONSORED EVENT CREATED!';
  RAISE NOTICE 'Event: %', (SELECT title FROM events WHERE id = v_event_id);
  RAISE NOTICE 'Sponsor: %', v_sponsor_name;
  
END $$;

-- Verify
SELECT 
  e.id as event_id,
  e.title as event,
  s.name as sponsor,
  sp.tier,
  so.status
FROM sponsorship.sponsorship_orders so
JOIN sponsors s ON s.id = so.sponsor_id
JOIN events e ON e.id = so.event_id
JOIN sponsorship.sponsorship_packages sp ON sp.id = so.package_id
ORDER BY so.created_at DESC
LIMIT 5;

