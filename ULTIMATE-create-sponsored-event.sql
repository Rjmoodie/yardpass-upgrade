-- =====================================================
-- ULTIMATE FIX: Create Sponsored Event
-- Works regardless of schema setup
-- =====================================================

-- Get event and sponsor info
SELECT 
  'Will create sponsorship for:' as step,
  (SELECT id FROM events LIMIT 1) as event_id,
  (SELECT title FROM events LIMIT 1) as event_title,
  (SELECT id FROM public.sponsors LIMIT 1) as sponsor_id,
  (SELECT name FROM public.sponsors LIMIT 1) as sponsor_name;

-- Create the sponsorship  
DO $$
DECLARE
  v_event_id uuid := (SELECT id FROM events LIMIT 1);
  v_sponsor_id_from_public uuid := (SELECT id FROM public.sponsors LIMIT 1);
  v_package_id uuid;
  v_sponsor_id_in_schema uuid;
BEGIN
  -- First, check if sponsorship.sponsors exists and sync
  BEGIN
    -- Try to ensure sponsor exists in sponsorship schema (if that table exists)
    EXECUTE format('INSERT INTO sponsorship.sponsors (id, name, logo_url, website_url, description, industry, company_size)
                    SELECT id, name, logo_url, website_url, description, industry, company_size
                    FROM public.sponsors WHERE id = %L
                    ON CONFLICT (id) DO NOTHING', v_sponsor_id_from_public);
    
    v_sponsor_id_in_schema := v_sponsor_id_from_public;
    RAISE NOTICE 'Synced sponsor to sponsorship schema';
  EXCEPTION
    WHEN undefined_table THEN
      -- sponsorship.sponsors doesn't exist, FK must point to public.sponsors
      v_sponsor_id_in_schema := v_sponsor_id_from_public;
      RAISE NOTICE 'Using public.sponsors directly';
  END;
  
  -- Create package
  INSERT INTO sponsorship.sponsorship_packages (
    event_id, title, tier, price_cents, currency, inventory, sold,
    benefits, visibility, is_active
  )
  VALUES (
    v_event_id, 'Gold Sponsorship', 'Gold', 500000, 'USD', 2, 1,
    '{"logo": true, "booth": true}'::jsonb, 'public', true
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_package_id;
  
  -- If package already existed, get its ID
  IF v_package_id IS NULL THEN
    SELECT id INTO v_package_id 
    FROM sponsorship.sponsorship_packages 
    WHERE event_id = v_event_id AND tier = 'Gold' 
    LIMIT 1;
  END IF;
  
  RAISE NOTICE 'Package ID: %', v_package_id;
  
  -- Create order
  INSERT INTO sponsorship.sponsorship_orders (
    package_id, sponsor_id, event_id, amount_cents, status
  )
  VALUES (
    v_package_id, v_sponsor_id_in_schema, v_event_id, 500000, 'live'
  )
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE '✅ Sponsored event created!';
  
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error: %', SQLERRM;
END $$;

-- Verify
SELECT 
  e.title as event,
  s.name as sponsor,
  sp.tier,
  so.status
FROM sponsorship.sponsorship_orders so
JOIN public.sponsors s ON s.id = so.sponsor_id
JOIN events e ON e.id = so.event_id
JOIN sponsorship.sponsorship_packages sp ON sp.id = so.package_id
LIMIT 5;

