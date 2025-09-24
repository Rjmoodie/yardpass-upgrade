-- RLS Security Tests for Cross-Tenant Access Prevention
-- Run these tests to verify that users cannot access data from other tenants/organizations

-- Test 1: Events - User A cannot access User B's individual events
DO $$
DECLARE
    user_a_id uuid := '11111111-1111-1111-1111-111111111111';
    user_b_id uuid := '22222222-2222-2222-2222-222222222222';
    event_a_id uuid;
    event_b_id uuid;
    test_result boolean;
BEGIN
    -- Setup: Create events for different users
    SET LOCAL "request.jwt.claims" = '{"sub": "' || user_a_id || '", "role": "authenticated"}';
    
    INSERT INTO events (id, title, owner_context_type, owner_context_id, created_by, visibility, start_at, end_at)
    VALUES (gen_random_uuid(), 'User A Event', 'individual', user_a_id, user_a_id, 'private', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days')
    RETURNING id INTO event_a_id;
    
    SET LOCAL "request.jwt.claims" = '{"sub": "' || user_b_id || '", "role": "authenticated"}';
    
    INSERT INTO events (id, title, owner_context_type, owner_context_id, created_by, visibility, start_at, end_at)
    VALUES (gen_random_uuid(), 'User B Event', 'individual', user_b_id, user_b_id, 'private', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days')
    RETURNING id INTO event_b_id;
    
    -- Test: User A tries to access User B's event
    SET LOCAL "request.jwt.claims" = '{"sub": "' || user_a_id || '", "role": "authenticated"}';
    
    SELECT EXISTS(SELECT 1 FROM events WHERE id = event_b_id) INTO test_result;
    
    IF test_result THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: User A can access User B private event';
    ELSE
        RAISE NOTICE 'PASS: Cross-tenant event access blocked';
    END IF;
    
    -- Cleanup
    DELETE FROM events WHERE id IN (event_a_id, event_b_id);
END $$;

-- Test 2: Orders - User cannot access another user's orders
DO $$
DECLARE
    user_a_id uuid := '11111111-1111-1111-1111-111111111111';
    user_b_id uuid := '22222222-2222-2222-2222-222222222222';
    order_a_id uuid;
    order_b_id uuid;
    event_id uuid;
    test_result boolean;
BEGIN
    -- Setup: Create a public event and orders for different users
    INSERT INTO events (id, title, owner_context_type, owner_context_id, created_by, visibility, start_at, end_at)
    VALUES (gen_random_uuid(), 'Public Event', 'individual', user_a_id, user_a_id, 'public', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days')
    RETURNING id INTO event_id;
    
    SET LOCAL "request.jwt.claims" = '{"sub": "' || user_a_id || '", "role": "authenticated"}';
    
    INSERT INTO orders (id, event_id, user_id, status, total_cents)
    VALUES (gen_random_uuid(), event_id, user_a_id, 'paid', 1000)
    RETURNING id INTO order_a_id;
    
    SET LOCAL "request.jwt.claims" = '{"sub": "' || user_b_id || '", "role": "authenticated"}';
    
    INSERT INTO orders (id, event_id, user_id, status, total_cents)
    VALUES (gen_random_uuid(), event_id, user_b_id, 'paid', 2000)
    RETURNING id INTO order_b_id;
    
    -- Test: User A tries to access User B's order
    SET LOCAL "request.jwt.claims" = '{"sub": "' || user_a_id || '", "role": "authenticated"}';
    
    SELECT EXISTS(SELECT 1 FROM orders WHERE id = order_b_id) INTO test_result;
    
    IF test_result THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: User A can access User B order';
    ELSE
        RAISE NOTICE 'PASS: Cross-tenant order access blocked';
    END IF;
    
    -- Cleanup
    DELETE FROM orders WHERE id IN (order_a_id, order_b_id);
    DELETE FROM events WHERE id = event_id;
END $$;

-- Test 3: Sponsor Members - User cannot access another sponsor's members
DO $$
DECLARE
    user_a_id uuid := '11111111-1111-1111-1111-111111111111';
    user_b_id uuid := '22222222-2222-2222-2222-222222222222';
    user_c_id uuid := '33333333-3333-3333-3333-333333333333';
    sponsor_a_id uuid;
    sponsor_b_id uuid;
    test_result boolean;
BEGIN
    -- Setup: Create sponsors and memberships
    INSERT INTO sponsors (id, name, created_by)
    VALUES (gen_random_uuid(), 'Sponsor A', user_a_id)
    RETURNING id INTO sponsor_a_id;
    
    INSERT INTO sponsors (id, name, created_by)
    VALUES (gen_random_uuid(), 'Sponsor B', user_b_id)
    RETURNING id INTO sponsor_b_id;
    
    -- Add members to each sponsor
    INSERT INTO sponsor_members (sponsor_id, user_id, role)
    VALUES 
        (sponsor_a_id, user_a_id, 'owner'),
        (sponsor_b_id, user_b_id, 'owner'),
        (sponsor_b_id, user_c_id, 'viewer');
    
    -- Test: User A tries to access Sponsor B's members
    SET LOCAL "request.jwt.claims" = '{"sub": "' || user_a_id || '", "role": "authenticated"}';
    
    SELECT EXISTS(
        SELECT 1 FROM sponsor_members 
        WHERE sponsor_id = sponsor_b_id AND user_id = user_c_id
    ) INTO test_result;
    
    IF test_result THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: User A can access Sponsor B members';
    ELSE
        RAISE NOTICE 'PASS: Cross-sponsor member access blocked';
    END IF;
    
    -- Cleanup
    DELETE FROM sponsor_members WHERE sponsor_id IN (sponsor_a_id, sponsor_b_id);
    DELETE FROM sponsors WHERE id IN (sponsor_a_id, sponsor_b_id);
END $$;

-- Test 4: Organization Memberships - User cannot access other org memberships
DO $$
DECLARE
    user_a_id uuid := '11111111-1111-1111-1111-111111111111';
    user_b_id uuid := '22222222-2222-2222-2222-222222222222';
    user_c_id uuid := '33333333-3333-3333-3333-333333333333';
    org_a_id uuid;
    org_b_id uuid;
    test_result boolean;
BEGIN
    -- Setup: Create organizations
    INSERT INTO organizations (id, name, created_by)
    VALUES 
        (gen_random_uuid(), 'Org A', user_a_id),
        (gen_random_uuid(), 'Org B', user_b_id)
    RETURNING id INTO org_a_id, org_b_id;
    
    -- Add memberships
    INSERT INTO org_memberships (org_id, user_id, role)
    VALUES 
        (org_a_id, user_a_id, 'owner'),
        (org_b_id, user_b_id, 'owner'),
        (org_b_id, user_c_id, 'editor');
    
    -- Test: User A tries to access Org B memberships
    SET LOCAL "request.jwt.claims" = '{"sub": "' || user_a_id || '", "role": "authenticated"}';
    
    SELECT EXISTS(
        SELECT 1 FROM org_memberships 
        WHERE org_id = org_b_id AND user_id = user_c_id
    ) INTO test_result;
    
    IF test_result THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: User A can access Org B memberships';
    ELSE
        RAISE NOTICE 'PASS: Cross-org membership access blocked';
    END IF;
    
    -- Cleanup
    DELETE FROM org_memberships WHERE org_id IN (org_a_id, org_b_id);
    DELETE FROM organizations WHERE id IN (org_a_id, org_b_id);
END $$;

-- Test 5: Payout Accounts - User cannot access other user's payout accounts
DO $$
DECLARE
    user_a_id uuid := '11111111-1111-1111-1111-111111111111';
    user_b_id uuid := '22222222-2222-2222-2222-222222222222';
    payout_a_id uuid;
    payout_b_id uuid;
    test_result boolean;
BEGIN
    -- Setup: Create payout accounts
    INSERT INTO payout_accounts (id, context_type, context_id, stripe_connect_id)
    VALUES 
        (gen_random_uuid(), 'individual', user_a_id, 'acct_test_a'),
        (gen_random_uuid(), 'individual', user_b_id, 'acct_test_b')
    RETURNING id INTO payout_a_id, payout_b_id;
    
    -- Test: User A tries to access User B's payout account
    SET LOCAL "request.jwt.claims" = '{"sub": "' || user_a_id || '", "role": "authenticated"}';
    
    SELECT EXISTS(
        SELECT 1 FROM payout_accounts 
        WHERE context_type = 'individual' AND context_id = user_b_id
    ) INTO test_result;
    
    IF test_result THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: User A can access User B payout account';
    ELSE
        RAISE NOTICE 'PASS: Cross-tenant payout account access blocked';
    END IF;
    
    -- Cleanup
    DELETE FROM payout_accounts WHERE id IN (payout_a_id, payout_b_id);
END $$;

-- Test 6: Sponsorship Orders - User cannot access orders from other sponsors
DO $$
DECLARE
    user_a_id uuid := '11111111-1111-1111-1111-111111111111';
    user_b_id uuid := '22222222-2222-2222-2222-222222222222';
    user_c_id uuid := '33333333-3333-3333-3333-333333333333';
    sponsor_a_id uuid;
    sponsor_b_id uuid;
    event_id uuid;
    package_id uuid;
    order_id uuid;
    test_result boolean;
BEGIN
    -- Setup: Create sponsors, event, package, and order
    INSERT INTO sponsors (id, name, created_by)
    VALUES 
        (gen_random_uuid(), 'Sponsor A', user_a_id),
        (gen_random_uuid(), 'Sponsor B', user_b_id)
    RETURNING id INTO sponsor_a_id, sponsor_b_id;
    
    INSERT INTO sponsor_members (sponsor_id, user_id, role)
    VALUES 
        (sponsor_a_id, user_a_id, 'owner'),
        (sponsor_b_id, user_b_id, 'owner');
    
    INSERT INTO events (id, title, owner_context_type, owner_context_id, created_by, visibility, start_at, end_at)
    VALUES (gen_random_uuid(), 'Event for Sponsorship', 'individual', user_c_id, user_c_id, 'public', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days')
    RETURNING id INTO event_id;
    
    INSERT INTO sponsorship_packages (id, event_id, tier, price_cents, created_by)
    VALUES (gen_random_uuid(), event_id, 'gold', 100000, user_c_id)
    RETURNING id INTO package_id;
    
    -- Create sponsorship order for Sponsor B
    SET LOCAL "request.jwt.claims" = '{"sub": "' || user_b_id || '", "role": "authenticated"}';
    
    INSERT INTO sponsorship_orders (id, package_id, sponsor_id, event_id, amount_cents, status)
    VALUES (gen_random_uuid(), package_id, sponsor_b_id, event_id, 100000, 'paid')
    RETURNING id INTO order_id;
    
    -- Test: User A (Sponsor A) tries to access Sponsor B's order
    SET LOCAL "request.jwt.claims" = '{"sub": "' || user_a_id || '", "role": "authenticated"}';
    
    SELECT EXISTS(SELECT 1 FROM sponsorship_orders WHERE id = order_id) INTO test_result;
    
    IF test_result THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: Sponsor A can access Sponsor B order';
    ELSE
        RAISE NOTICE 'PASS: Cross-sponsor order access blocked';
    END IF;
    
    -- Cleanup
    DELETE FROM sponsorship_orders WHERE id = order_id;
    DELETE FROM sponsorship_packages WHERE id = package_id;
    DELETE FROM events WHERE id = event_id;
    DELETE FROM sponsor_members WHERE sponsor_id IN (sponsor_a_id, sponsor_b_id);
    DELETE FROM sponsors WHERE id IN (sponsor_a_id, sponsor_b_id);
END $$;

-- Test 7: Sponsorship Packages - Check access control
DO $$
DECLARE
    user_a_id uuid := '11111111-1111-1111-1111-111111111111';
    user_b_id uuid := '22222222-2222-2222-2222-222222222222';
    event_a_id uuid;
    event_b_id uuid;
    package_a_id uuid;
    package_b_id uuid;
    test_result boolean;
BEGIN
    -- Setup: Create events and packages for different users
    SET LOCAL "request.jwt.claims" = '{"sub": "' || user_a_id || '", "role": "authenticated"}';
    
    INSERT INTO events (id, title, owner_context_type, owner_context_id, created_by, visibility, start_at, end_at)
    VALUES (gen_random_uuid(), 'Event A', 'individual', user_a_id, user_a_id, 'private', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days')
    RETURNING id INTO event_a_id;
    
    INSERT INTO sponsorship_packages (id, event_id, tier, price_cents, visibility, created_by)
    VALUES (gen_random_uuid(), event_a_id, 'gold', 100000, 'private', user_a_id)
    RETURNING id INTO package_a_id;
    
    SET LOCAL "request.jwt.claims" = '{"sub": "' || user_b_id || '", "role": "authenticated"}';
    
    INSERT INTO events (id, title, owner_context_type, owner_context_id, created_by, visibility, start_at, end_at)
    VALUES (gen_random_uuid(), 'Event B', 'individual', user_b_id, user_b_id, 'private', NOW() + INTERVAL '1 day', NOW() + INTERVAL '2 days')
    RETURNING id INTO event_b_id;
    
    INSERT INTO sponsorship_packages (id, event_id, tier, price_cents, visibility, created_by)
    VALUES (gen_random_uuid(), event_b_id, 'silver', 50000, 'private', user_b_id)
    RETURNING id INTO package_b_id;
    
    -- Test: User A tries to access User B's private sponsorship package
    SET LOCAL "request.jwt.claims" = '{"sub": "' || user_a_id || '", "role": "authenticated"}';
    
    SELECT EXISTS(SELECT 1 FROM sponsorship_packages WHERE id = package_b_id) INTO test_result;
    
    IF test_result THEN
        RAISE EXCEPTION 'SECURITY VIOLATION: User A can access User B private sponsorship package';
    ELSE
        RAISE NOTICE 'PASS: Cross-tenant sponsorship package access blocked';
    END IF;
    
    -- Cleanup
    DELETE FROM sponsorship_packages WHERE id IN (package_a_id, package_b_id);
    DELETE FROM events WHERE id IN (event_a_id, event_b_id);
END $$;

-- Summary
SELECT 'All RLS cross-tenant access tests completed. Check above for any SECURITY VIOLATIONS.' as test_summary;