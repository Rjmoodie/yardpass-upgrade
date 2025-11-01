-- =====================================================
-- FIX: Create Sponsored Event (Handles Schema Issues)
-- =====================================================

-- First, let's see what we're working with
SELECT 'Available Sponsors:' as info;
SELECT id, name, industry FROM public.sponsors;

SELECT 'Available Events:' as info;
SELECT id, title FROM events LIMIT 5;

-- Create sponsored event using PUBLIC schema explicitly
DO $$
DECLARE
  v_event_id uuid;
  v_sponsor_id uuid;
  v_package_id uuid;
  v_order_id uuid;
BEGIN
  -- Get first event
  SELECT id INTO v_event_id FROM public.events LIMIT 1;
  
  -- Get TechCorp (or first sponsor)
  SELECT id INTO v_sponsor_id FROM public.sponsors LIMIT 1;
  
  RAISE NOTICE 'Event: %', v_event_id;
  RAISE NOTICE 'Sponsor: %', v_sponsor_id;
  
  -- Check if package already exists for this event
  SELECT id INTO v_package_id 
  FROM sponsorship.sponsorship_packages 
  WHERE event_id = v_event_id 
  AND tier = 'Gold'
  LIMIT 1;
  
  -- Create package if it doesn't exist
  IF v_package_id IS NULL THEN
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
      '{"logo_placement": "prominent", "speaking_slot": true, "booth_space": "premium"}'::jsonb,
      'public',
      true
    )
    RETURNING id INTO v_package_id;
    
    RAISE NOTICE 'Created package: %', v_package_id;
  ELSE
    RAISE NOTICE 'Using existing package: %', v_package_id;
  END IF;
  
  -- Check if order already exists
  SELECT id INTO v_order_id
  FROM sponsorship.sponsorship_orders
  WHERE event_id = v_event_id
  AND sponsor_id = v_sponsor_id;
  
  IF v_order_id IS NULL THEN
    -- Create order - use explicit schema for sponsor reference
    INSERT INTO sponsorship.sponsorship_orders (
      package_id,
      sponsor_id,
      event_id,
      amount_cents,
      status,
      created_at
    )
    SELECT
      v_package_id,
      s.id, -- Get ID from public.sponsors
      v_event_id,
      500000,
      'live',
      now()
    FROM public.sponsors s
    WHERE s.id = v_sponsor_id;
    
    RAISE NOTICE '✅ Sponsorship created!';
  ELSE
    -- Update existing order to live
    UPDATE sponsorship.sponsorship_orders
    SET status = 'live'
    WHERE id = v_order_id;
    
    RAISE NOTICE '✅ Updated existing sponsorship to live!';
  END IF;
  
END $$;

-- Final verification
SELECT 
  '🎉 SPONSORED EVENT' as status,
  e.title as event,
  s.name as sponsor,
  sp.tier,
  so.status
FROM sponsorship.sponsorship_orders so
JOIN public.sponsors s ON s.id = so.sponsor_id
JOIN public.events e ON e.id = so.event_id
JOIN sponsorship.sponsorship_packages sp ON sp.id = so.package_id
WHERE so.status = 'live'
LIMIT 1;

