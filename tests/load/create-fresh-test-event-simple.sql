-- Create a fresh test event for k6 load testing (no auth required)
-- This creates an event with 50 available tickets

DO $$
DECLARE
    v_org_id UUID;
    v_event_id UUID;
    v_tier_id UUID;
BEGIN
    -- Create a test organization first
    INSERT INTO organizations (
        name,
        handle,
        description,
        created_by
    ) VALUES (
        'K6 Test Organization',
        'k6-test-org-' || extract(epoch from now())::text,
        'Test organization for k6 load testing',
        '00000000-0000-0000-0000-000000000000' -- Dummy user ID
    ) RETURNING id INTO v_org_id;
    
    -- Create the test event
    INSERT INTO public.events (
        title, 
        description, 
        start_at, 
        venue, 
        city, 
        address,
        cover_image_url,
        owner_context_type,
        owner_context_id
    ) VALUES (
        '[K6 LOAD TEST] Fresh Event ' || extract(epoch from now())::text,
        'Test event for k6 load testing with available tickets',
        now() + interval '30 days',
        'Test Venue',
        'Test City',
        '123 Test St',
        'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4',
        'organization',
        v_org_id
    ) RETURNING id INTO v_event_id;
    
    -- Create ticket tier with 50 available tickets
    INSERT INTO public.ticket_tiers (
        event_id,
        name,
        price_cents,
        total_quantity,
        reserved_quantity
    ) VALUES (
        v_event_id,
        'General Admission',
        5000, -- $50.00
        50,   -- 50 total tickets
        0     -- 0 reserved (all available)
    ) RETURNING id INTO v_tier_id;
    
    -- Return the IDs for use in k6 test
    RAISE NOTICE 'Event ID: %', v_event_id;
    RAISE NOTICE 'Tier ID: %', v_tier_id;
    RAISE NOTICE 'Organization ID: %', v_org_id;
    
END $$;

-- Query to get the created IDs
SELECT 
    e.id as event_id,
    tt.id as tier_id,
    e.title,
    tt.name,
    tt.total_quantity,
    tt.reserved_quantity,
    (tt.total_quantity - tt.reserved_quantity) as available_tickets
FROM events e
JOIN ticket_tiers tt ON tt.event_id = e.id
WHERE e.title LIKE '[K6 LOAD TEST] Fresh Event%'
ORDER BY e.created_at DESC
LIMIT 1;


