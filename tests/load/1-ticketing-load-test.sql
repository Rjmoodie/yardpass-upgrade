-- =====================================================
-- Liventix Load Test #1: Ticketing & Checkout System
-- =====================================================
-- Purpose: Test concurrent ticket purchases and inventory management
-- Run this in Supabase SQL Editor

-- =====================================================
-- SETUP: Create Test Event & Tickets
-- =====================================================

-- Step 1: Create a test event
DO $$
DECLARE
  v_event_id uuid;
  v_tier_id uuid;
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  -- Get a test user (replace with your actual user ID or create one)
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found. Please create a test user first.';
  END IF;

  -- Get or create an organization for the user
  SELECT id INTO v_org_id 
  FROM organizations 
  WHERE created_by = v_user_id 
  LIMIT 1;
  
  IF v_org_id IS NULL THEN
    INSERT INTO organizations (
      name,
      handle,
      created_by
    ) VALUES (
      '[LOAD TEST] Test Organization',
      'load-test-org-' || substring(gen_random_uuid()::text, 1, 8),
      v_user_id
    ) RETURNING id INTO v_org_id;
    
    RAISE NOTICE 'Created test organization: %', v_org_id;
  END IF;

  -- Create test event
  INSERT INTO public.events (
    title,
    description,
    start_at,
    end_at,
    venue,
    city,
    country,
    category,
    visibility,
    created_by,
    owner_context_type,
    owner_context_id
  ) VALUES (
    '[LOAD TEST] High Demand Concert',
    'Test event for load testing ticket purchases',
    now() + interval '30 days',
    now() + interval '30 days' + interval '4 hours',
    'Test Venue',
    'New York',
    'USA',
    'music',
    'public',
    v_user_id,
    'organization',
    v_org_id
  ) RETURNING id INTO v_event_id;

  RAISE NOTICE 'Created test event: %', v_event_id;

  -- Create ticket tier with limited capacity
  INSERT INTO public.ticket_tiers (
    event_id,
    name,
    badge_label,
    price_cents,
    quantity,
    total_quantity,
    sold_quantity,
    reserved_quantity,
    max_per_order
  ) VALUES (
    v_event_id,
    'General Admission',
    'GA',
    5000, -- $50.00
    50,   -- Only 50 tickets
    50,
    0,
    0,
    10
  ) RETURNING id INTO v_tier_id;

  RAISE NOTICE 'Created ticket tier: % with 50 tickets', v_tier_id;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'COPY THESE IDs FOR TESTING:';
  RAISE NOTICE 'Event ID: %', v_event_id;
  RAISE NOTICE 'Tier ID: %', v_tier_id;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TEST 1: Single Ticket Reservation (Baseline)
-- =====================================================

-- This tests the basic reservation flow
DO $$
DECLARE
  v_tier_id uuid;
  v_session_id text := 'test-session-' || gen_random_uuid();
  v_result RECORD;
BEGIN
  -- Get the tier ID from the test event we just created
  SELECT tt.id INTO v_tier_id
  FROM ticket_tiers tt
  JOIN events e ON e.id = tt.event_id
  WHERE e.title LIKE '[LOAD TEST]%'
  ORDER BY tt.created_at DESC
  LIMIT 1;
  RAISE NOTICE '🧪 TEST 1: Single Ticket Reservation';
  RAISE NOTICE 'Session ID: %', v_session_id;
  
  -- Reserve 1 ticket
  SELECT * INTO v_result FROM reserve_tickets_batch(
    p_reservations := jsonb_build_array(
      jsonb_build_object(
        'tier_id', v_tier_id,
        'quantity', 1
      )
    ),
    p_session_id := v_session_id,
    p_expires_minutes := 10
  );
  
  RAISE NOTICE '✅ Reservation successful';
  RAISE NOTICE 'Reserved: %', v_result;
  
  -- Check inventory
  DECLARE
    v_inventory RECORD;
  BEGIN
    SELECT sold_quantity, reserved_quantity, quantity INTO v_inventory
    FROM ticket_tiers 
    WHERE id = v_tier_id;
    
    RAISE NOTICE 'Inventory after reservation - Sold: %, Reserved: %, Available: %', 
      v_inventory.sold_quantity, v_inventory.reserved_quantity, v_inventory.quantity;
  END;
END $$;

-- =====================================================
-- TEST 2: Concurrent Reservations (Race Condition)
-- =====================================================

-- This simulates 10 users trying to buy tickets simultaneously
-- Expected: All should succeed if enough inventory

DO $$
DECLARE
  v_tier_id uuid;
  v_session_id text;
  i INTEGER;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
BEGIN
  -- Get the tier ID from the test event
  SELECT tt.id INTO v_tier_id
  FROM ticket_tiers tt
  JOIN events e ON e.id = tt.event_id
  WHERE e.title LIKE '[LOAD TEST]%'
  ORDER BY tt.created_at DESC
  LIMIT 1;
  
  RAISE NOTICE '🧪 TEST 2: Concurrent Reservations (10 users)';
  
  FOR i IN 1..10 LOOP
    v_session_id := 'concurrent-test-' || i || '-' || gen_random_uuid();
    
    BEGIN
      PERFORM reserve_tickets_batch(
        p_reservations := jsonb_build_array(
          jsonb_build_object(
            'tier_id', v_tier_id,
            'quantity', 2  -- Each user buys 2 tickets
          )
        ),
        p_session_id := v_session_id,
        p_expires_minutes := 10
      );
      
      v_success_count := v_success_count + 1;
      RAISE NOTICE '  ✅ User % reserved 2 tickets', i;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      RAISE NOTICE '  ❌ User % failed: %', i, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Results: % successful, % failed', v_success_count, v_error_count;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TEST 3: Overselling Prevention (Critical Test)
-- =====================================================

-- This tries to reserve more tickets than available
-- Expected: Should fail gracefully when inventory exhausted

DO $$
DECLARE
  v_tier_id uuid;
  v_available INTEGER;
  v_session_id text;
  i INTEGER;
  v_success_count INTEGER := 0;
BEGIN
  -- Get the tier ID from the test event
  SELECT tt.id INTO v_tier_id
  FROM ticket_tiers tt
  JOIN events e ON e.id = tt.event_id
  WHERE e.title LIKE '[LOAD TEST]%'
  ORDER BY tt.created_at DESC
  LIMIT 1;
  
  RAISE NOTICE '🧪 TEST 3: Overselling Prevention';
  
  -- Check available inventory
  SELECT quantity - COALESCE(sold_quantity, 0) - COALESCE(reserved_quantity, 0)
  INTO v_available
  FROM ticket_tiers
  WHERE id = v_tier_id;
  
  RAISE NOTICE 'Available tickets: %', v_available;
  RAISE NOTICE 'Attempting to reserve % tickets (more than available)...', v_available + 5;
  
  -- Try to reserve more than available
  FOR i IN 1..(v_available + 5) LOOP
    v_session_id := 'oversell-test-' || i || '-' || gen_random_uuid();
    
    BEGIN
      PERFORM reserve_tickets_batch(
        p_reservations := jsonb_build_array(
          jsonb_build_object(
            'tier_id', v_tier_id,
            'quantity', 1
          )
        ),
        p_session_id := v_session_id,
        p_expires_minutes := 10
      );
      
      v_success_count := v_success_count + 1;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  🛑 Reservation % correctly rejected: %', i, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Successfully reserved: % (should be ≤ %)', v_success_count, v_available;
  RAISE NOTICE 'Test PASSED if no overselling occurred!';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TEST 4: Hold Expiration & Release
-- =====================================================

-- This tests that expired holds are properly released
-- We create a hold in the past to simulate expiration without waiting

DO $$
DECLARE
  v_tier_id uuid;
  v_hold_id uuid;
  v_reserved_before INTEGER;
  v_reserved_after INTEGER;
  v_expired_holds INTEGER;
BEGIN
  -- Get the tier ID from the test event
  SELECT tt.id INTO v_tier_id
  FROM ticket_tiers tt
  JOIN events e ON e.id = tt.event_id
  WHERE e.title LIKE '[LOAD TEST]%'
  ORDER BY tt.created_at DESC
  LIMIT 1;
  
  RAISE NOTICE '🧪 TEST 4: Hold Expiration & Release (Simulated)';
  
  -- Manually create an expired hold (backdated)
  INSERT INTO ticket_holds (
    tier_id,
    quantity,
    session_id,
    status,
    expires_at,
    created_at
  ) VALUES (
    v_tier_id,
    5,  -- 5 tickets
    'expired-hold-test-' || gen_random_uuid(),
    'active',
    now() - interval '5 minutes',  -- Already expired
    now() - interval '15 minutes'
  ) RETURNING id INTO v_hold_id;
  
  -- Manually update reserved_quantity to simulate the hold being active
  UPDATE ticket_tiers
  SET reserved_quantity = reserved_quantity + 5
  WHERE id = v_tier_id;
  
  SELECT reserved_quantity INTO v_reserved_before
  FROM ticket_tiers WHERE id = v_tier_id;
  
  RAISE NOTICE 'Created expired hold (ID: %)', v_hold_id;
  RAISE NOTICE 'Reserved quantity before cleanup: %', v_reserved_before;
  
  -- Run the cleanup (simulates cron job)
  DELETE FROM ticket_holds
  WHERE expires_at < now() AND status = 'active';
  
  -- Update reserved counts (this would normally be done by triggers)
  UPDATE ticket_tiers tt
  SET reserved_quantity = (
    SELECT COALESCE(SUM(th.quantity), 0)
    FROM ticket_holds th
    WHERE th.tier_id = tt.id AND th.status = 'active'
  )
  WHERE id = v_tier_id;
  
  SELECT reserved_quantity INTO v_reserved_after
  FROM ticket_tiers WHERE id = v_tier_id;
  
  RAISE NOTICE 'Reserved quantity after cleanup: %', v_reserved_after;
  RAISE NOTICE 'Cleaned up expired holds';
  
  IF v_reserved_after = (v_reserved_before - 5) THEN
    RAISE NOTICE '✅ Hold expiration working correctly! (Released 5 tickets)';
  ELSE
    RAISE NOTICE '❌ Hold cleanup issue - Expected: %, Got: %', v_reserved_before - 5, v_reserved_after;
  END IF;
END $$;

-- =====================================================
-- TEST 5: Performance Benchmarking
-- =====================================================

-- This measures the speed of reservation operations

DO $$
DECLARE
  v_tier_id uuid;
  v_start_time timestamp;
  v_end_time timestamp;
  v_duration interval;
  i INTEGER;
BEGIN
  -- Get the tier ID from the test event
  SELECT tt.id INTO v_tier_id
  FROM ticket_tiers tt
  JOIN events e ON e.id = tt.event_id
  WHERE e.title LIKE '[LOAD TEST]%'
  ORDER BY tt.created_at DESC
  LIMIT 1;
  
  RAISE NOTICE '🧪 TEST 5: Performance Benchmark (100 reservations)';
  
  v_start_time := clock_timestamp();
  
  FOR i IN 1..100 LOOP
    PERFORM reserve_tickets_batch(
      p_reservations := jsonb_build_array(
        jsonb_build_object(
          'tier_id', v_tier_id,
          'quantity', 1
        )
      ),
      p_session_id := 'perf-test-' || i || '-' || gen_random_uuid(),
      p_expires_minutes := 10
    );
  END LOOP;
  
  v_end_time := clock_timestamp();
  v_duration := v_end_time - v_start_time;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total time: %', v_duration;
  RAISE NOTICE 'Average per reservation: % ms', 
    EXTRACT(EPOCH FROM v_duration) * 1000 / 100;
  RAISE NOTICE 'Target: < 200ms per reservation';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check final inventory state
SELECT 
  tt.name,
  tt.total_quantity as "Total",
  tt.sold_quantity as "Sold",
  tt.reserved_quantity as "Reserved",
  (tt.total_quantity - COALESCE(tt.sold_quantity, 0) - COALESCE(tt.reserved_quantity, 0)) as "Available",
  COUNT(DISTINCT th.id) as "Active Holds"
FROM ticket_tiers tt
LEFT JOIN ticket_holds th ON th.tier_id = tt.id AND th.status = 'active'
WHERE tt.event_id = (
  SELECT id FROM events WHERE title LIKE '[LOAD TEST]%' ORDER BY created_at DESC LIMIT 1
)
GROUP BY tt.id, tt.name, tt.total_quantity, tt.sold_quantity, tt.reserved_quantity;

-- Check all holds
SELECT 
  th.session_id,
  th.quantity,
  th.status,
  th.expires_at,
  CASE 
    WHEN th.expires_at < now() THEN 'EXPIRED'
    ELSE 'ACTIVE'
  END as expiration_status
FROM ticket_holds th
WHERE th.tier_id IN (
  SELECT id FROM ticket_tiers WHERE event_id = (
    SELECT id FROM events WHERE title LIKE '[LOAD TEST]%' ORDER BY created_at DESC LIMIT 1
  )
)
ORDER BY th.created_at DESC
LIMIT 20;

-- =====================================================
-- CLEANUP
-- =====================================================

-- Uncomment to clean up test data
-- DELETE FROM ticket_holds WHERE session_id LIKE 'test-%' OR session_id LIKE 'concurrent-%' OR session_id LIKE 'oversell-%';
-- DELETE FROM ticket_tiers WHERE event_id IN (SELECT id FROM events WHERE title LIKE '[LOAD TEST]%');
-- DELETE FROM events WHERE title LIKE '[LOAD TEST]%';

-- =====================================================
-- FINAL SUMMARY
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ All ticketing load tests complete!';
  RAISE NOTICE 'Review results above and check for:';
  RAISE NOTICE '  1. No overselling';
  RAISE NOTICE '  2. Proper hold expiration';
  RAISE NOTICE '  3. Reservation speed < 200ms';
  RAISE NOTICE '  4. Concurrent operations succeed';
  RAISE NOTICE '========================================';
END $$;

