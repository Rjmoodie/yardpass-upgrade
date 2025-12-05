-- ============================================================================
-- ADD CAPACITY CONSTRAINTS TO TICKET TIERS
-- Migration: 20251211_add_capacity_constraints.sql
-- Purpose: Prevent over-selling and data corruption
-- ============================================================================
-- 
-- SAFETY: This migration checks for violations BEFORE adding constraints
-- If violations found, they must be fixed manually first
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: PRE-FLIGHT CHECK - Find any violators
-- ============================================================================

-- Check for tiers that would violate constraints
DO $$
DECLARE
  v_violators INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_violators
  FROM ticketing.ticket_tiers
  WHERE issued_quantity > quantity
     OR reserved_quantity + issued_quantity > quantity
     OR quantity < 0
     OR issued_quantity < 0
     OR reserved_quantity < 0;

  IF v_violators > 0 THEN
    RAISE EXCEPTION 'CONSTRAINT VIOLATION: % tiers have invalid data. Run fix query first!', v_violators;
  END IF;

  RAISE NOTICE '✅ Pre-flight check passed: No constraint violations found';
END $$;

-- ============================================================================
-- STEP 2: ADD CONSTRAINTS
-- ============================================================================

-- Constraint 1: Non-negative quantities
ALTER TABLE ticketing.ticket_tiers
ADD CONSTRAINT IF NOT EXISTS check_quantities_non_negative
CHECK (
  quantity >= 0 
  AND COALESCE(issued_quantity, 0) >= 0 
  AND COALESCE(reserved_quantity, 0) >= 0
);

-- Constraint 2: Issued cannot exceed capacity
ALTER TABLE ticketing.ticket_tiers
ADD CONSTRAINT IF NOT EXISTS check_issued_not_exceeds_capacity
CHECK (COALESCE(issued_quantity, 0) <= quantity);

-- Constraint 3: Reserved + Issued cannot exceed capacity
ALTER TABLE ticketing.ticket_tiers
ADD CONSTRAINT IF NOT EXISTS check_total_not_exceeds_capacity
CHECK (COALESCE(reserved_quantity, 0) + COALESCE(issued_quantity, 0) <= quantity);

-- ============================================================================
-- STEP 3: VERIFICATION
-- ============================================================================

-- List all constraints on ticket_tiers
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'ticketing.ticket_tiers'::regclass
  AND contype = 'c'  -- CHECK constraints
ORDER BY conname;

-- Test the constraints (should fail)
DO $$
BEGIN
  -- This should fail
  INSERT INTO ticketing.ticket_tiers (event_id, name, quantity, issued_quantity)
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    'TEST',
    10,
    11  -- More issued than capacity
  );
  
  RAISE EXCEPTION 'CONSTRAINT TEST FAILED: Insert should have been rejected!';
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE '✅ Constraint test passed: Invalid insert was rejected';
    ROLLBACK;
END $$;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================

SELECT '✅ Constraints added successfully!' as status;

-- Show current state of all tiers (verify all pass constraints)
SELECT 
  e.title,
  tt.name,
  tt.quantity as capacity,
  tt.issued_quantity as issued,
  tt.reserved_quantity as reserved,
  (tt.quantity - tt.reserved_quantity - tt.issued_quantity) as available,
  CASE 
    WHEN tt.issued_quantity > tt.quantity THEN '🔴 VIOLATES: issued > capacity'
    WHEN (tt.reserved_quantity + tt.issued_quantity) > tt.quantity THEN '🔴 VIOLATES: reserved+issued > capacity'
    ELSE '✅ VALID'
  END as constraint_status
FROM ticketing.ticket_tiers tt
JOIN events.events e ON e.id = tt.event_id
ORDER BY constraint_status, e.title;

-- Expected: All rows show '✅ VALID'

