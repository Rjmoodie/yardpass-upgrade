-- =====================================================
-- FINAL: Create Sponsored Event (All Issues Fixed)
-- =====================================================

-- Copy sponsors to sponsorship schema with created_by
-- Use first available user ID as creator
DO $$
DECLARE
  v_user_id uuid := (SELECT id FROM auth.users LIMIT 1);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found - cannot create sponsors';
  END IF;
  
  INSERT INTO sponsorship.sponsors (id, name, logo_url, website_url, industry, company_size, created_by)
  SELECT 
    id, 
    name, 
    logo_url, 
    website_url, 
    industry, 
    company_size,
    v_user_id as created_by
  FROM public.sponsors
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE 'Copied % sponsors to sponsorship schema', (SELECT COUNT(*) FROM public.sponsors);
END $$;

-- Verify sponsors copied
SELECT 'Sponsors in sponsorship schema:' as step, COUNT(*) as count FROM sponsorship.sponsors;

-- Create sponsored event
DO $$
DECLARE
  v_event_id uuid := (SELECT id FROM events LIMIT 1);
  v_sponsor_id uuid := (SELECT id FROM sponsorship.sponsors LIMIT 1);
  v_package_id uuid;
  v_event_title text;
  v_sponsor_name text;
BEGIN
  SELECT title INTO v_event_title FROM events WHERE id = v_event_id;
  SELECT name INTO v_sponsor_name FROM sponsorship.sponsors WHERE id = v_sponsor_id;
  
  RAISE NOTICE 'Creating sponsorship:';
  RAISE NOTICE '  Event: %', v_event_title;
  RAISE NOTICE '  Sponsor: %', v_sponsor_name;
  
  -- Create Gold package
  INSERT INTO sponsorship.sponsorship_packages (
    event_id, title, tier, price_cents, currency, inventory, sold,
    benefits, visibility, is_active
  )
  VALUES (
    v_event_id, 'Gold Sponsorship', 'Gold', 500000, 'USD', 2, 1,
    '{"logo_placement": "prominent", "speaking_slot": true, "booth_space": "premium"}'::jsonb, 
    'public', true
  )
  RETURNING id INTO v_package_id;
  
  -- Create active sponsorship order
  INSERT INTO sponsorship.sponsorship_orders (
    package_id, sponsor_id, event_id, amount_cents, status
  )
  VALUES (
    v_package_id, v_sponsor_id, v_event_id, 500000, 'live'
  );
  
  RAISE NOTICE '✅ SUCCESS! Event "%"is now sponsored by "%"', v_event_title, v_sponsor_name;
END $$;

-- Final verification
SELECT 
  '🎉 SPONSORED EVENT CREATED' as status,
  e.id as event_id,
  e.title as event_name,
  s.name as sponsor_name,
  sp.tier as sponsor_tier,
  so.status as order_status,
  '$' || (so.amount_cents / 100)::text as amount
FROM sponsorship.sponsorship_orders so
JOIN sponsorship.sponsors s ON s.id = so.sponsor_id
JOIN events e ON e.id = so.event_id
JOIN sponsorship.sponsorship_packages sp ON sp.id = so.package_id
WHERE so.status = 'live'
ORDER BY so.created_at DESC
LIMIT 1;

