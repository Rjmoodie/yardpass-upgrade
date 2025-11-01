-- Add 2 More Sponsors to Tech Conference 2024
-- This will demonstrate the multi-sponsor badge (avatar circles)

DO $$
DECLARE
  v_event_id uuid := '41cc320a-c01e-4425-af32-86452e7466e5'; -- Tech Conference 2024
  v_user_id uuid := (SELECT id FROM auth.users LIMIT 1);
  v_sponsor2_id uuid := '00000000-0000-0000-0000-000000000002'; -- GreenEarth Solutions
  v_sponsor3_id uuid := '00000000-0000-0000-0000-000000000003'; -- Athletic Pro Gear
  v_package_silver uuid;
  v_package_bronze uuid;
BEGIN
  -- Ensure sponsors exist in sponsorship schema
  INSERT INTO sponsorship.sponsors (id, name, logo_url, website_url, industry, company_size, created_by)
  SELECT 
    id, 
    name, 
    logo_url, 
    website_url, 
    industry, 
    company_size,
    v_user_id
  FROM public.sponsors
  WHERE id IN (v_sponsor2_id, v_sponsor3_id)
  ON CONFLICT (id) DO NOTHING;

  -- Create Silver Tier Package
  INSERT INTO sponsorship.sponsorship_packages (
    event_id, title, tier, price_cents, currency, inventory, sold,
    benefits, visibility, is_active, created_at
  )
  VALUES (
    v_event_id, 'Silver Sponsorship', 'Silver', 250000, 'USD', 3, 1,
    '{"logo": true, "booth": true}'::jsonb, 'public', true, now()
  )
  ON CONFLICT (event_id, tier) DO UPDATE SET
    title = EXCLUDED.title,
    price_cents = EXCLUDED.price_cents
  RETURNING id INTO v_package_silver;

  -- Create Bronze Tier Package
  INSERT INTO sponsorship.sponsorship_packages (
    event_id, title, tier, price_cents, currency, inventory, sold,
    benefits, visibility, is_active, created_at
  )
  VALUES (
    v_event_id, 'Bronze Sponsorship', 'Bronze', 100000, 'USD', 5, 1,
    '{"logo": true}'::jsonb, 'public', true, now()
  )
  ON CONFLICT (event_id, tier) DO UPDATE SET
    title = EXCLUDED.title,
    price_cents = EXCLUDED.price_cents
  RETURNING id INTO v_package_bronze;

  -- Create Silver Sponsorship Order (GreenEarth Solutions)
  INSERT INTO sponsorship.sponsorship_orders (
    package_id, sponsor_id, event_id, amount_cents, status, created_at
  )
  VALUES (
    v_package_silver, v_sponsor2_id, v_event_id, 250000, 'live', now()
  )
  ON CONFLICT (package_id, sponsor_id) DO UPDATE SET
    status = 'live',
    amount_cents = 250000;

  -- Create Bronze Sponsorship Order (Athletic Pro Gear)
  INSERT INTO sponsorship.sponsorship_orders (
    package_id, sponsor_id, event_id, amount_cents, status, created_at
  )
  VALUES (
    v_package_bronze, v_sponsor3_id, v_event_id, 100000, 'live', now()
  )
  ON CONFLICT (package_id, sponsor_id) DO UPDATE SET
    status = 'live',
    amount_cents = 100000;

  RAISE NOTICE '✅ Added 2 more sponsors to Tech Conference 2024!';
END $$;

-- Verify all sponsors
SELECT 
  e.title as event_name,
  s.name as sponsor_name,
  sp.tier,
  so.status,
  so.amount_cents / 100.0 as amount
FROM sponsorship.sponsorship_orders so
JOIN sponsorship.sponsors s ON s.id = so.sponsor_id
JOIN events e ON e.id = so.event_id
JOIN sponsorship.sponsorship_packages sp ON sp.id = so.package_id
WHERE so.event_id = '41cc320a-c01e-4425-af32-86452e7466e5'
ORDER BY 
  CASE sp.tier 
    WHEN 'Gold' THEN 1 
    WHEN 'Silver' THEN 2 
    WHEN 'Bronze' THEN 3 
    ELSE 4 
  END;

