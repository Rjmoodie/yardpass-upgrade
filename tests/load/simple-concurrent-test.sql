-- =====================================================
-- Simple Concurrent Reservation Test
-- =====================================================
-- Purpose: Test concurrent reservations in SQL Editor
-- This simulates concurrent access without needing pgbench
--
-- Run this in Supabase SQL Editor
-- =====================================================

-- This test simulates concurrent users by rapidly creating multiple reservations
-- While not TRUE concurrency (that requires pgbench), it helps verify basic logic

DO $$
DECLARE
  v_tier_id uuid;
  v_session_id text;
  i INTEGER;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  v_start_time timestamp;
  v_end_time timestamp;
  v_duration interval;
BEGIN
  -- Get the race test tier
  SELECT tt.id INTO v_tier_id
  FROM ticket_tiers tt
  JOIN events e ON e.id = tt.event_id
  WHERE e.title LIKE '[RACE TEST]%'
  ORDER BY tt.created_at DESC
  LIMIT 1;
  
  IF v_tier_id IS NULL THEN
    RAISE EXCEPTION 'No race test tier found. Run race-condition-test.sql first.';
  END IF;
  
  RAISE NOTICE '🧪 SIMULATED CONCURRENT RESERVATION TEST';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Testing with tier: %', v_tier_id;
  RAISE NOTICE 'Simulating 30 users trying to reserve 2 tickets each';
  RAISE NOTICE 'Only 10 tickets available - 25 users should fail!';
  RAISE NOTICE '';
  
  v_start_time := clock_timestamp();
  
  -- Simulate 30 concurrent users
  FOR i IN 1..30 LOOP
    v_session_id := 'concurrent-sim-' || i || '-' || gen_random_uuid();
    
    BEGIN
      PERFORM reserve_tickets_batch(
        p_reservations := jsonb_build_array(
          jsonb_build_object(
            'tier_id', v_tier_id,
            'quantity', 2
          )
        ),
        p_session_id := v_session_id,
        p_expires_minutes := 10
      );
      
      v_success_count := v_success_count + 1;
      RAISE NOTICE '  ✅ User % succeeded', i;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      RAISE NOTICE '  ❌ User % failed: %', i, SQLERRM;
    END;
  END LOOP;
  
  v_end_time := clock_timestamp();
  v_duration := v_end_time - v_start_time;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 RESULTS:';
  RAISE NOTICE '  Total attempts: 30';
  RAISE NOTICE '  Successful: % (reserved % tickets)', v_success_count, v_success_count * 2;
  RAISE NOTICE '  Failed: %', v_error_count;
  RAISE NOTICE '  Duration: %', v_duration;
  RAISE NOTICE '  Avg per attempt: % ms', EXTRACT(EPOCH FROM v_duration) * 1000 / 30;
  RAISE NOTICE '';
  
  -- Check final inventory
  DECLARE
    v_inventory RECORD;
  BEGIN
    SELECT 
      total_quantity,
      sold_quantity,
      reserved_quantity,
      (total_quantity - COALESCE(sold_quantity, 0) - COALESCE(reserved_quantity, 0)) as available
    INTO v_inventory
    FROM ticket_tiers
    WHERE id = v_tier_id;
    
    RAISE NOTICE '📊 FINAL INVENTORY:';
    RAISE NOTICE '  Total: %', v_inventory.total_quantity;
    RAISE NOTICE '  Reserved: %', v_inventory.reserved_quantity;
    RAISE NOTICE '  Available: %', v_inventory.available;
    RAISE NOTICE '';
    
    -- Verify no overselling
    IF v_inventory.reserved_quantity <= v_inventory.total_quantity THEN
      RAISE NOTICE '✅ NO OVERSELLING - Test PASSED!';
      RAISE NOTICE '   Reserved % tickets (max was 10)', v_inventory.reserved_quantity;
    ELSE
      RAISE EXCEPTION '❌ CRITICAL: OVERSELLING DETECTED! Reserved % but only % available', 
        v_inventory.reserved_quantity, v_inventory.total_quantity;
    END IF;
    
    -- Verify expected results
    IF v_success_count = 5 AND v_inventory.reserved_quantity = 10 THEN
      RAISE NOTICE '✅ PERFECT: Exactly 5 users got 2 tickets each (10 total)';
    ELSIF v_inventory.reserved_quantity = 10 THEN
      RAISE NOTICE '✅ CORRECT: All 10 tickets reserved (some users got 1, some got 2)';
    ELSE
      RAISE NOTICE '⚠️  UNEXPECTED: Reserved %, expected 10', v_inventory.reserved_quantity;
    END IF;
  END;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '💡 NOTE: This is a SIMULATION in single session.';
  RAISE NOTICE '   For TRUE concurrency testing, use pgbench:';
  RAISE NOTICE '   pgbench -f pgbench-reserve.sql -c 50 -T 30 <connection>';
  RAISE NOTICE '';
END $$;


