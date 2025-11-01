-- =====================================================
-- CREATE A SPONSORED EVENT FOR TESTING
-- =====================================================

-- 1. Get an event and a sponsor
DO $$
DECLARE
  v_event_id uuid;
  v_sponsor_id uuid;
  v_package_id uuid;
BEGIN
  -- Get first event
  SELECT id INTO v_event_id FROM events LIMIT 1;
  
  -- Get TechCorp sponsor
  SELECT id INTO v_sponsor_id FROM sponsors WHERE name = 'TechCorp Industries' LIMIT 1;
  
  RAISE NOTICE 'Event ID: %', v_event_id;
  RAISE NOTICE 'Sponsor ID: %', v_sponsor_id;
  
  -- Create a Gold package for this event (if not exists)
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
    '{"logo_placement": "prominent", "speaking_slot": true, "booth_space": "premium", "social_mentions": true}'::jsonb,
    'public',
    true
  )
  RETURNING id INTO v_package_id;
  
  RAISE NOTICE 'Package ID: %', v_package_id;
  
  -- Create a sponsorship order (active sponsorship)
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
    'live' -- Active sponsorship!
  );
  
  RAISE NOTICE '✅ Created sponsored event!';
  RAISE NOTICE 'Event: %', (SELECT title FROM events WHERE id = v_event_id);
  RAISE NOTICE 'Sponsor: TechCorp Industries (Gold Tier)';
  
END $$;

-- Verify the sponsorship was created
SELECT 
  e.title as event_title,
  s.name as sponsor_name,
  sp.tier,
  so.status,
  so.amount_cents
FROM sponsorship.sponsorship_orders so
JOIN sponsors s ON s.id = so.sponsor_id
JOIN events e ON e.id = so.event_id
JOIN sponsorship.sponsorship_packages sp ON sp.id = so.package_id
WHERE so.status = 'live';

