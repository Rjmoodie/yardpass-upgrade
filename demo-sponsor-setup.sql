DO $$
DECLARE
  v_event_id UUID;
  v_package_id UUID;
  v_sponsor_id UUID;
  v_order_id UUID;
BEGIN
  SELECT id INTO v_event_id FROM events.events WHERE title = 'Splish and Splash' LIMIT 1;
  
  IF v_event_id IS NULL THEN
    SELECT id INTO v_event_id FROM events.events LIMIT 1;
  END IF;

  SELECT id INTO v_sponsor_id FROM public.sponsors WHERE name = 'Splash Beverages Co.' LIMIT 1;

  IF v_sponsor_id IS NULL THEN
    INSERT INTO public.sponsors (name, industry, logo_url, description)
    VALUES ('Splash Beverages Co.', 'food_beverage', 
            'https://ui-avatars.com/api/?name=Splash+Beverages&background=0066cc&color=fff&size=200&bold=true',
            'Premium hydration partner')
    RETURNING id INTO v_sponsor_id;
  END IF;

  SELECT id INTO v_package_id FROM sponsorship.sponsorship_packages 
  WHERE event_id = v_event_id AND tier = 'Gold' LIMIT 1;

  IF v_package_id IS NULL THEN
    INSERT INTO sponsorship.sponsorship_packages (event_id, tier, title, description, price_cents, inventory, sold, benefits, is_active, visibility)
    VALUES (v_event_id, 'Gold', 'Gold Sponsorship', 'Premium placement', 500000, 5, 0, 
            ARRAY['Logo placement', 'Feed visibility', 'Search visibility'], true, 'public')
    RETURNING id INTO v_package_id;
  END IF;

  SELECT id INTO v_order_id FROM sponsorship.sponsorship_orders 
  WHERE sponsor_id = v_sponsor_id AND event_id = v_event_id LIMIT 1;

  IF v_order_id IS NULL THEN
    INSERT INTO sponsorship.sponsorship_orders (package_id, sponsor_id, event_id, status, amount_cents)
    VALUES (v_package_id, v_sponsor_id, v_event_id, 'live', 500000);
  ELSE
    UPDATE sponsorship.sponsorship_orders SET status = 'live' WHERE id = v_order_id;
  END IF;

  RAISE NOTICE 'SUCCESS! Hard refresh browser to see sponsor badges!';
END $$;
