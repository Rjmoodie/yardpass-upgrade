-- =====================================================
-- Simple Concurrent Reservation Test (With Visible Output)
-- =====================================================
-- Purpose: Test concurrent reservations with visible results
-- Run this in Supabase SQL Editor
-- =====================================================

-- First, let's check the current state
SELECT 
  'BEFORE TEST' as status,
  tt.name as tier_name,
  tt.total_quantity as total,
  tt.sold_quantity as sold,
  tt.reserved_quantity as reserved,
  (tt.total_quantity - COALESCE(tt.sold_quantity, 0) - COALESCE(tt.reserved_quantity, 0)) as available
FROM ticket_tiers tt
JOIN events e ON e.id = tt.event_id
WHERE e.title LIKE '[RACE TEST]%'
ORDER BY tt.created_at DESC
LIMIT 1;

-- Now run the concurrent simulation
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
  
  v_start_time := clock_timestamp();
  
  -- Simulate 30 concurrent users (each wants 2 tickets = 60 tickets requested)
  -- Only 10 tickets available - so only 5 users should succeed
  FOR i IN 1..30 LOOP
    v_session_id := 'sim-' || i || '-' || gen_random_uuid();
    
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
      
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
    END;
  END LOOP;
  
  v_end_time := clock_timestamp();
  v_duration := v_end_time - v_start_time;
  
  -- Store results in a temp table for display
  CREATE TEMP TABLE IF NOT EXISTS test_results (
    test_name text,
    metric text,
    value text
  );
  
  DELETE FROM test_results;
  
  INSERT INTO test_results VALUES
    ('Concurrent Simulation', 'Total Attempts', '30'),
    ('Concurrent Simulation', 'Successful Reservations', v_success_count::text),
    ('Concurrent Simulation', 'Failed Reservations', v_error_count::text),
    ('Concurrent Simulation', 'Tickets Reserved', (v_success_count * 2)::text),
    ('Concurrent Simulation', 'Duration', v_duration::text),
    ('Concurrent Simulation', 'Avg Time per Attempt', (EXTRACT(EPOCH FROM v_duration) * 1000 / 30)::text || ' ms');
END $$;

-- Show results
SELECT * FROM test_results ORDER BY metric;

-- Show final inventory state
SELECT 
  'AFTER TEST' as status,
  tt.name as tier_name,
  tt.total_quantity as total,
  tt.sold_quantity as sold,
  tt.reserved_quantity as reserved,
  (tt.total_quantity - COALESCE(tt.sold_quantity, 0) - COALESCE(tt.reserved_quantity, 0)) as available,
  COUNT(DISTINCT th.id) as active_holds
FROM ticket_tiers tt
LEFT JOIN ticket_holds th ON th.tier_id = tt.id AND th.status = 'active'
WHERE tt.id = (
  SELECT tt2.id 
  FROM ticket_tiers tt2
  JOIN events e ON e.id = tt2.event_id
  WHERE e.title LIKE '[RACE TEST]%'
  ORDER BY tt2.created_at DESC
  LIMIT 1
)
GROUP BY tt.id, tt.name, tt.total_quantity, tt.sold_quantity, tt.reserved_quantity;

-- Show all active holds
SELECT 
  'ACTIVE HOLDS' as info,
  th.session_id,
  th.quantity,
  th.created_at,
  th.expires_at
FROM ticket_holds th
WHERE th.tier_id = (
  SELECT tt.id 
  FROM ticket_tiers tt
  JOIN events e ON e.id = tt.event_id
  WHERE e.title LIKE '[RACE TEST]%'
  ORDER BY tt.created_at DESC
  LIMIT 1
)
AND th.status = 'active'
ORDER BY th.created_at;

-- Final validation
SELECT 
  CASE 
    WHEN tt.reserved_quantity <= tt.total_quantity THEN '✅ PASS'
    ELSE '❌ FAIL - OVERSELLING!'
  END as test_result,
  tt.reserved_quantity as tickets_reserved,
  tt.total_quantity as max_available,
  CASE 
    WHEN tt.reserved_quantity > tt.total_quantity 
    THEN (tt.reserved_quantity - tt.total_quantity)::text || ' OVERSOLD!'
    ELSE 'No overselling'
  END as validation
FROM ticket_tiers tt
WHERE tt.id = (
  SELECT tt2.id 
  FROM ticket_tiers tt2
  JOIN events e ON e.id = tt2.event_id
  WHERE e.title LIKE '[RACE TEST]%'
  ORDER BY tt2.created_at DESC
  LIMIT 1
);


