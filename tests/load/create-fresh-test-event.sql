-- Create a fresh test event for k6 load testing
-- This creates an event with 50 available tickets

DO $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
    v_event_id UUID;
    v_tier_id UUID;
BEGIN
    -- Get current user ID
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user found. Please log in first.';
    END IF;
    
    -- Get or create organization for the user
    SELECT id INTO v_org_id FROM organizations WHERE created_by = v_user_id LIMIT 1;
    
    IF v_org_id IS NULL THEN
        INSERT INTO organizations (
            name,
            handle,
            description,
            created_by
        ) VALUES (
            'Test Organization',
            'test-org-' || substring(v_user_id::text, 1, 8),
            'Test organization for load testing',
            v_user_id
        ) RETURNING id INTO v_org_id;
    END IF;
    
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
        '[K6 LOAD TEST] Fresh Event',
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
    tt.reserved_quantity
FROM events e
JOIN ticket_tiers tt ON tt.event_id = e.id
WHERE e.title = '[K6 LOAD TEST] Fresh Event'
ORDER BY e.created_at DESC
LIMIT 1;

