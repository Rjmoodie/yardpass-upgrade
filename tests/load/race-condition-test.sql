-- =====================================================
-- Liventix TRUE RACE CONDITION & CONCURRENCY TEST
-- =====================================================
-- Purpose: Test real concurrent access with multiple sessions
-- This uses pgbench for true multi-session concurrency testing
--
-- Prerequisites:
-- 1. Install pgbench (comes with PostgreSQL)
-- 2. Run setup section first to create test data
-- 3. Then run pgbench commands from terminal
--
-- =====================================================

-- =====================================================
-- PART 1: SETUP - Run this in Supabase SQL Editor
-- =====================================================

DO $$
DECLARE
  v_event_id uuid;
  v_tier_id uuid;
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  RAISE NOTICE '🚀 Setting up True Concurrency Test...';
  
  -- Get test user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found. Create a test user first.';
  END IF;

  -- Get or create organization
  SELECT id INTO v_org_id 
  FROM organizations 
  WHERE created_by = v_user_id 
  LIMIT 1;
  
  IF v_org_id IS NULL THEN
    INSERT INTO organizations (name, handle, created_by)
    VALUES (
      '[RACE TEST] Organization',
      'race-test-org-' || substring(gen_random_uuid()::text, 1, 8),
      v_user_id
    ) RETURNING id INTO v_org_id;
  END IF;

  -- Create event with very limited tickets (forces contention)
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
    '[RACE TEST] High Contention Event',
    'Event with only 10 tickets to force race conditions',
    now() + interval '30 days',
    now() + interval '30 days' + interval '4 hours',
    'Race Test Venue',
    'New York',
    'USA',
    'music',
    'public',
    v_user_id,
    'organization',
    v_org_id
  ) RETURNING id INTO v_event_id;

  -- Create tier with VERY limited capacity (10 tickets)
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
    'Limited VIP',
    'VIP',
    10000,
    10,   -- Only 10 tickets to force contention
    10,
    0,
    0,
    5     -- Max 5 per order
  ) RETURNING id INTO v_tier_id;

  -- Store in a temporary table for pgbench scripts
  CREATE TEMP TABLE IF NOT EXISTS pgbench_tiers (
    pos integer PRIMARY KEY,
    id uuid NOT NULL
  );
  
  INSERT INTO pgbench_tiers (pos, id) VALUES (1, v_tier_id)
  ON CONFLICT (pos) DO UPDATE SET id = EXCLUDED.id;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Setup Complete!';
  RAISE NOTICE 'Event ID: %', v_event_id;
  RAISE NOTICE 'Tier ID: %', v_tier_id;
  RAISE NOTICE 'Tickets Available: 10';
  RAISE NOTICE '';
  RAISE NOTICE '📋 NEXT STEPS:';
  RAISE NOTICE '1. Copy tier ID above';
  RAISE NOTICE '2. Create pgbench script (see instructions below)';
  RAISE NOTICE '3. Run pgbench from terminal';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- CRITICAL INVARIANT CHECKS
-- =====================================================
-- Run these AFTER load testing to verify data integrity

-- Check 1: No negative availability
DO $$
DECLARE
  v_negative_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_negative_count
  FROM ticket_tiers
  WHERE (total_quantity - COALESCE(sold_quantity,0) - COALESCE(reserved_quantity,0)) < 0;
  
  IF v_negative_count > 0 THEN
    RAISE EXCEPTION '❌ CRITICAL: % tiers have negative availability (OVERSOLD!)', v_negative_count;
  ELSE
    RAISE NOTICE '✅ Check 1: No negative availability';
  END IF;
END $$;

-- Check 2: Reserved never exceeds total
DO $$
DECLARE
  v_over_reserved INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_over_reserved
  FROM ticket_tiers
  WHERE reserved_quantity > total_quantity;
  
  IF v_over_reserved > 0 THEN
    RAISE EXCEPTION '❌ CRITICAL: % tiers over-reserved', v_over_reserved;
  ELSE
    RAISE NOTICE '✅ Check 2: Reserved ≤ total';
  END IF;
END $$;

-- Check 3: Sold never exceeds total
DO $$
DECLARE
  v_oversold INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_oversold
  FROM ticket_tiers
  WHERE sold_quantity > total_quantity;
  
  IF v_oversold > 0 THEN
    RAISE EXCEPTION '❌ CRITICAL: % tiers oversold', v_oversold;
  ELSE
    RAISE NOTICE '✅ Check 3: Sold ≤ total';
  END IF;
END $$;

-- Check 4: Active holds match reserved_quantity
DO $$
DECLARE
  v_mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_mismatch_count
  FROM ticket_tiers tt
  LEFT JOIN (
    SELECT tier_id, COALESCE(SUM(quantity),0) as hold_sum
    FROM ticket_holds
    WHERE status = 'active'
    GROUP BY tier_id
  ) h ON h.tier_id = tt.id
  WHERE COALESCE(h.hold_sum, 0) != tt.reserved_quantity;
  
  IF v_mismatch_count > 0 THEN
    RAISE WARNING '⚠️ WARNING: % tiers have hold/reserved mismatch', v_mismatch_count;
  ELSE
    RAISE NOTICE '✅ Check 4: Hold sums match reserved_quantity';
  END IF;
END $$;

-- Check 5: No duplicate tickets
DO $$
DECLARE
  v_duplicates INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_duplicates
  FROM (
    SELECT qr_code, COUNT(*) as cnt
    FROM tickets
    GROUP BY qr_code
    HAVING COUNT(*) > 1
  ) sub;
  
  IF v_duplicates > 0 THEN
    RAISE EXCEPTION '❌ CRITICAL: % duplicate QR codes found!', v_duplicates;
  ELSE
    RAISE NOTICE '✅ Check 5: No duplicate tickets';
  END IF;
END $$;

-- =====================================================
-- PERFORMANCE INDEXES (Add these for production)
-- =====================================================

-- Active holds by tier (critical for reserve operations)
CREATE INDEX IF NOT EXISTS idx_ticket_holds_tier_active
ON ticket_holds (tier_id)
WHERE status = 'active';

-- Unique constraint to prevent duplicate active holds per session/tier
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_hold_session_tier
ON ticket_holds (session_id, tier_id)
WHERE status = 'active' AND session_id IS NOT NULL;

-- Ticket tiers by event (for event page loads)
CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event
ON ticket_tiers (event_id);

-- Expired holds cleanup (for cron job)
CREATE INDEX IF NOT EXISTS idx_ticket_holds_expiry
ON ticket_holds (expires_at)
WHERE status = 'active';

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- Check final state after load test
SELECT 
  tt.name as "Tier",
  tt.total_quantity as "Total",
  tt.sold_quantity as "Sold",
  tt.reserved_quantity as "Reserved",
  (tt.total_quantity - COALESCE(tt.sold_quantity, 0) - COALESCE(tt.reserved_quantity, 0)) as "Available",
  COUNT(DISTINCT CASE WHEN th.status = 'active' THEN th.id END) as "Active Holds",
  COUNT(DISTINCT CASE WHEN th.status = 'expired' THEN th.id END) as "Expired Holds",
  COUNT(DISTINCT t.id) as "Tickets Issued"
FROM ticket_tiers tt
LEFT JOIN ticket_holds th ON th.tier_id = tt.id
LEFT JOIN tickets t ON t.tier_id = tt.id
WHERE tt.event_id = (
  SELECT id FROM events WHERE title LIKE '[RACE TEST]%' ORDER BY created_at DESC LIMIT 1
)
GROUP BY tt.id, tt.name, tt.total_quantity, tt.sold_quantity, tt.reserved_quantity;

-- =====================================================
-- CLEANUP
-- =====================================================

-- Uncomment to remove test data
-- DELETE FROM ticket_holds WHERE tier_id IN (
--   SELECT id FROM ticket_tiers WHERE event_id IN (
--     SELECT id FROM events WHERE title LIKE '[RACE TEST]%'
--   )
-- );
-- DELETE FROM tickets WHERE event_id IN (SELECT id FROM events WHERE title LIKE '[RACE TEST]%');
-- DELETE FROM ticket_tiers WHERE event_id IN (SELECT id FROM events WHERE title LIKE '[RACE TEST]%');
-- DELETE FROM events WHERE title LIKE '[RACE TEST]%';
-- DELETE FROM organizations WHERE name LIKE '[RACE TEST]%';

-- =====================================================
-- INSTRUCTIONS FOR PGBENCH TESTING
-- =====================================================

/*

PGBENCH SETUP (Run from terminal):

1. Create reserve.sql file:
   
   \set tier_id 'PASTE_YOUR_TIER_ID_HERE'
   \set qty 2
   
   BEGIN;
   SELECT reserve_tickets_batch(
     p_reservations := jsonb_build_array(
       jsonb_build_object(
         'tier_id', :'tier_id'::uuid,
         'quantity', :qty
       )
     ),
     p_session_id := 'pgbench-' || :client_id || '-' || :scale,
     p_expires_minutes := 10
   );
   COMMIT;

2. Run pgbench (replace with your DB connection):

   pgbench -f reserve.sql \
     -n \
     -c 50 \
     -j 10 \
     -T 30 \
     -r \
     postgresql://postgres:password@db.project.supabase.co:5432/postgres

   Flags:
   -c 50  = 50 concurrent clients (sessions)
   -j 10  = 10 threads
   -T 30  = Run for 30 seconds
   -r     = Report per-statement latency
   -n     = No vacuum (faster)

3. Analyze output:

   Look for:
   - TPS (transactions per second)
   - p50, p90, p99 latency
   - Failed transactions (should be 0 if no overselling)

4. Run invariant checks above to verify:
   - No overselling
   - No negative availability
   - Counts are consistent

EXPECTED RESULTS:

✅ Total successful reservations ≤ 10 tickets
✅ All invariant checks pass
✅ p99 latency < 500ms
✅ No database errors

*/

