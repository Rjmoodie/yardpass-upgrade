-- Create sample data for analytics testing with proper UUIDs

-- First check if we have any users to work with
DO $$
DECLARE
    sample_user_id uuid;
    sample_org_id uuid := gen_random_uuid();
    event1_id uuid := gen_random_uuid();
    event2_id uuid := gen_random_uuid();
    tier1_id uuid := gen_random_uuid();
    tier2_id uuid := gen_random_uuid();
    tier3_id uuid := gen_random_uuid();
    tier4_id uuid := gen_random_uuid();
    order1_id uuid := gen_random_uuid();
    order2_id uuid := gen_random_uuid();
    item1_id uuid := gen_random_uuid();
    item2_id uuid := gen_random_uuid();
BEGIN
    -- Get a sample user (create one if none exists)
    SELECT id INTO sample_user_id FROM auth.users LIMIT 1;
    
    IF sample_user_id IS NULL THEN
        -- If no users exist, skip this migration
        RAISE NOTICE 'No users found, skipping sample data creation';
        RETURN;
    END IF;

    -- Insert sample organization
    INSERT INTO public.organizations (id, name, handle, created_by, verification_status) 
    VALUES (sample_org_id, 'YardPass Demo Events', 'yardpass-demo', sample_user_id, 'basic') 
    ON CONFLICT (id) DO NOTHING;

    -- Add user to organization
    INSERT INTO public.org_memberships (user_id, org_id, role)
    VALUES (sample_user_id, sample_org_id, 'owner')
    ON CONFLICT (user_id, org_id) DO NOTHING;

    -- Insert sample events
    INSERT INTO public.events (id, title, description, owner_context_type, owner_context_id, created_by, start_at, end_at, venue, city, country, category, visibility)
    VALUES 
      (event1_id, 'Summer Music Festival 2024', 'Amazing outdoor music festival', 'organization', sample_org_id, sample_user_id, '2024-07-15 18:00:00+00', '2024-07-15 23:00:00+00', 'Central Park', 'New York', 'USA', 'Music', 'public'),
      (event2_id, 'Tech Conference 2024', 'Latest in technology trends', 'organization', sample_org_id, sample_user_id, '2024-08-20 09:00:00+00', '2024-08-20 17:00:00+00', 'Convention Center', 'San Francisco', 'USA', 'Technology', 'public')
    ON CONFLICT (id) DO NOTHING;

    -- Insert sample ticket tiers
    INSERT INTO public.ticket_tiers (id, event_id, name, price_cents, quantity, max_per_order, status)
    VALUES
      (tier1_id, event1_id, 'General Admission', 5000, 500, 6, 'active'),
      (tier2_id, event1_id, 'VIP', 15000, 100, 4, 'active'),
      (tier3_id, event2_id, 'Standard', 25000, 200, 5, 'active'),
      (tier4_id, event2_id, 'Premium', 50000, 50, 3, 'active')
    ON CONFLICT (id) DO NOTHING;

    -- Insert sample orders
    INSERT INTO public.orders (id, user_id, event_id, status, subtotal_cents, fees_cents, total_cents, currency, paid_at, created_at)
    VALUES 
      (order1_id, sample_user_id, event1_id, 'paid', 10000, 500, 10500, 'USD', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
      (order2_id, sample_user_id, event2_id, 'paid', 25000, 1250, 26250, 'USD', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
    ON CONFLICT (id) DO NOTHING;

    -- Insert sample order items
    INSERT INTO public.order_items (id, order_id, tier_id, quantity, unit_price_cents)
    VALUES
      (item1_id, order1_id, tier1_id, 2, 5000),
      (item2_id, order2_id, tier3_id, 1, 25000)
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Sample data created successfully';
END $$;