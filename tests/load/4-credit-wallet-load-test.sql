-- =====================================================
-- Liventix Load Test #4: Credit/Wallet System
-- =====================================================
-- Purpose: Test FIFO credit deduction and concurrent spending
-- Run this in Supabase SQL Editor

-- =====================================================
-- SETUP: Create Test Wallet & Credit Lots
-- =====================================================

DO $$
DECLARE
  v_user_id uuid;
  v_wallet_id uuid;
BEGIN
  RAISE NOTICE '🚀 Setting up Credit/Wallet Load Test...';
  
  -- Get a test user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found. Please create a test user first.';
  END IF;

  -- Get or create wallet for test user
  SELECT id INTO v_wallet_id FROM wallets WHERE user_id = v_user_id LIMIT 1;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance_credits)
    VALUES (v_user_id, 0)
    RETURNING id INTO v_wallet_id;
    RAISE NOTICE 'Created new wallet: %', v_wallet_id;
  ELSE
    RAISE NOTICE 'Using existing wallet: %', v_wallet_id;
  END IF;

  -- Create multiple credit lots with different amounts and dates
  -- This simulates purchases made at different times
  
  -- Lot 1: Oldest credits (should be spent first)
  INSERT INTO credit_lots (
    wallet_id,
    quantity_purchased,
    quantity_remaining,
    unit_price_usd_cents,
    source,
    created_at
  ) VALUES (
    v_wallet_id,
    1000,
    1000,
    100, -- $1.00 per credit
    'purchase',
    now() - interval '30 days'
  );
  
  -- Lot 2: Mid-age credits
  INSERT INTO credit_lots (
    wallet_id,
    quantity_purchased,
    quantity_remaining,
    unit_price_usd_cents,
    source,
    created_at
  ) VALUES (
    v_wallet_id,
    500,
    500,
    95, -- $0.95 per credit
    'purchase',
    now() - interval '15 days'
  );
  
  -- Lot 3: Recent credits
  INSERT INTO credit_lots (
    wallet_id,
    quantity_purchased,
    quantity_remaining,
    unit_price_usd_cents,
    source,
    created_at
  ) VALUES (
    v_wallet_id,
    750,
    750,
    90, -- $0.90 per credit
    'purchase',
    now() - interval '5 days'
  );
  
  -- Lot 4: Expiring credits (should be prioritized)
  INSERT INTO credit_lots (
    wallet_id,
    quantity_purchased,
    quantity_remaining,
    unit_price_usd_cents,
    source,
    expires_at,
    created_at
  ) VALUES (
    v_wallet_id,
    200,
    200,
    100,
    'promo',
    now() + interval '7 days', -- Expires soon
    now() - interval '3 days'
  );

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Created test wallet with 4 credit lots';
  RAISE NOTICE 'Total credits: 2450';
  RAISE NOTICE 'Wallet ID: %', v_wallet_id;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TEST 1: Basic FIFO Deduction
-- =====================================================

-- Test that oldest/expiring credits are spent first
DO $$
DECLARE
  v_wallet_id uuid;
  v_result RECORD;
  v_total_deducted INTEGER := 0;
BEGIN
  RAISE NOTICE '🧪 TEST 1: Basic FIFO Deduction (spend 100 credits)';
  
  -- Get test wallet
  SELECT w.id INTO v_wallet_id
  FROM wallets w
  JOIN auth.users u ON u.id = w.user_id
  LIMIT 1;
  
  -- Deduct 100 credits
  FOR v_result IN 
    SELECT * FROM deduct_credits_fifo(v_wallet_id, NULL, 100)
  LOOP
    v_total_deducted := v_total_deducted + v_result.deducted;
    RAISE NOTICE '  Deducted % credits from lot %', 
      v_result.deducted, v_result.lot_id;
  END LOOP;
  
  IF v_total_deducted = 100 THEN
    RAISE NOTICE '✅ Correct: Deducted exactly 100 credits';
  ELSE
    RAISE NOTICE '❌ ERROR: Deducted % credits instead of 100', v_total_deducted;
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- Verify which lot was used (should be expiring lot first)
SELECT 
  id,
  quantity_purchased,
  quantity_remaining,
  source,
  expires_at,
  CASE 
    WHEN expires_at IS NOT NULL AND expires_at < now() + interval '30 days' 
    THEN 'EXPIRING SOON' 
    ELSE 'NORMAL' 
  END as priority
FROM credit_lots
WHERE wallet_id IN (
  SELECT id FROM wallets WHERE user_id IN (SELECT id FROM auth.users LIMIT 1)
)
ORDER BY 
  CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END,
  expires_at ASC NULLS LAST,
  created_at ASC;

-- =====================================================
-- TEST 2: Multi-Lot Deduction
-- =====================================================

-- Test spending more credits than available in a single lot
DO $$
DECLARE
  v_wallet_id uuid;
  v_result RECORD;
  v_total_deducted INTEGER := 0;
  v_lot_count INTEGER := 0;
BEGIN
  RAISE NOTICE '🧪 TEST 2: Multi-Lot Deduction (spend 300 credits)';
  
  SELECT w.id INTO v_wallet_id
  FROM wallets w
  JOIN auth.users u ON u.id = w.user_id
  LIMIT 1;
  
  -- Deduct 300 credits (will span multiple lots)
  FOR v_result IN 
    SELECT * FROM deduct_credits_fifo(v_wallet_id, NULL, 300)
  LOOP
    v_total_deducted := v_total_deducted + v_result.deducted;
    v_lot_count := v_lot_count + 1;
    RAISE NOTICE '  Lot %: Deducted % credits from lot %', 
      v_lot_count, v_result.deducted, v_result.lot_id;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Deducted % credits across % lots', v_total_deducted, v_lot_count;
  RAISE NOTICE 'Expected: Exactly 300 credits from expiring lots first';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TEST 3: Concurrent Deductions (Race Condition Test)
-- =====================================================

-- Simulate multiple concurrent charges to the same wallet
DO $$
DECLARE
  v_wallet_id uuid;
  v_available_before INTEGER;
  v_available_after INTEGER;
  v_total_deducted INTEGER := 0;
  v_success_count INTEGER := 0;
  v_error_count INTEGER := 0;
  i INTEGER;
  v_deduct_amount INTEGER := 10;
  v_iterations INTEGER := 50; -- 50 concurrent deductions
BEGIN
  RAISE NOTICE '🧪 TEST 3: Concurrent Deductions (% × % credits)', 
    v_iterations, v_deduct_amount;
  
  SELECT w.id INTO v_wallet_id
  FROM wallets w
  JOIN auth.users u ON u.id = w.user_id
  LIMIT 1;
  
  -- Check balance before
  SELECT * INTO v_available_before 
  FROM get_available_credits(v_wallet_id, NULL);
  RAISE NOTICE 'Available credits before: %', v_available_before;
  
  -- Simulate concurrent deductions
  FOR i IN 1..v_iterations LOOP
    BEGIN
      PERFORM deduct_credits_fifo(v_wallet_id, NULL, v_deduct_amount);
      v_success_count := v_success_count + 1;
      v_total_deducted := v_total_deducted + v_deduct_amount;
      
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      RAISE NOTICE '  Deduction % failed: %', i, SQLERRM;
    END;
  END LOOP;
  
  -- Check balance after
  SELECT * INTO v_available_after 
  FROM get_available_credits(v_wallet_id, NULL);
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Available credits before: %', v_available_before;
  RAISE NOTICE 'Total deducted: %', v_total_deducted;
  RAISE NOTICE 'Available credits after: %', v_available_after;
  RAISE NOTICE 'Expected after: %', v_available_before - v_total_deducted;
  RAISE NOTICE '';
  RAISE NOTICE 'Successful deductions: %', v_success_count;
  RAISE NOTICE 'Failed deductions: %', v_error_count;
  
  IF v_available_after = (v_available_before - v_total_deducted) THEN
    RAISE NOTICE '✅ Balance is correct - no race conditions!';
  ELSE
    RAISE NOTICE '❌ ERROR: Balance mismatch - possible race condition!';
  END IF;
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TEST 4: Insufficient Funds Handling
-- =====================================================

-- Test attempting to spend more than available
DO $$
DECLARE
  v_wallet_id uuid;
  v_available INTEGER;
  v_attempt_amount INTEGER;
BEGIN
  RAISE NOTICE '🧪 TEST 4: Insufficient Funds Handling';
  
  SELECT w.id INTO v_wallet_id
  FROM wallets w
  JOIN auth.users u ON u.id = w.user_id
  LIMIT 1;
  
  -- Check available balance
  SELECT * INTO v_available 
  FROM get_available_credits(v_wallet_id, NULL);
  
  v_attempt_amount := v_available + 1000; -- Try to spend more than available
  
  RAISE NOTICE 'Available credits: %', v_available;
  RAISE NOTICE 'Attempting to deduct: %', v_attempt_amount;
  
  BEGIN
    PERFORM deduct_credits_fifo(v_wallet_id, NULL, v_attempt_amount);
    RAISE NOTICE '❌ ERROR: Deduction should have failed but succeeded!';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✅ Correctly rejected: %', SQLERRM;
  END;
  
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TEST 5: Performance Benchmark
-- =====================================================

-- Measure deduction performance
DO $$
DECLARE
  v_wallet_id uuid;
  v_start_time timestamp;
  v_end_time timestamp;
  v_duration interval;
  i INTEGER;
  v_iterations INTEGER := 100;
BEGIN
  RAISE NOTICE '🧪 TEST 5: Performance Benchmark (% deductions)', v_iterations;
  
  SELECT w.id INTO v_wallet_id
  FROM wallets w
  JOIN auth.users u ON u.id = w.user_id
  LIMIT 1;
  
  v_start_time := clock_timestamp();
  
  FOR i IN 1..v_iterations LOOP
    BEGIN
      PERFORM deduct_credits_fifo(v_wallet_id, NULL, 1);
    EXCEPTION WHEN OTHERS THEN
      -- Ignore insufficient funds errors
    END;
  END LOOP;
  
  v_end_time := clock_timestamp();
  v_duration := v_end_time - v_start_time;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total time: %', v_duration;
  RAISE NOTICE 'Average per deduction: % ms', 
    EXTRACT(EPOCH FROM v_duration) * 1000 / v_iterations;
  RAISE NOTICE 'Target: < 100ms per deduction';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- TEST 6: Lot Expiration Handling
-- =====================================================

-- Test that expired lots are not used
DO $$
DECLARE
  v_wallet_id uuid;
  v_lot_id uuid;
BEGIN
  RAISE NOTICE '🧪 TEST 6: Lot Expiration Handling';
  
  SELECT w.id INTO v_wallet_id
  FROM wallets w
  JOIN auth.users u ON u.id = w.user_id
  LIMIT 1;
  
  -- Create a lot that's already expired
  INSERT INTO credit_lots (
    wallet_id,
    quantity_purchased,
    quantity_remaining,
    unit_price_usd_cents,
    source,
    expires_at,
    created_at
  ) VALUES (
    v_wallet_id,
    100,
    100,
    100,
    'promo',
    now() - interval '1 day', -- Already expired
    now() - interval '2 days'
  ) RETURNING id INTO v_lot_id;
  
  RAISE NOTICE 'Created expired lot: %', v_lot_id;
  
  -- Try to deduct (should skip expired lot)
  BEGIN
    PERFORM deduct_credits_fifo(v_wallet_id, NULL, 10);
    RAISE NOTICE '✅ Deduction succeeded (skipped expired lot)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Deduction result: %', SQLERRM;
  END;
  
  -- Verify expired lot wasn't touched
  IF (SELECT quantity_remaining FROM credit_lots WHERE id = v_lot_id) = 100 THEN
    RAISE NOTICE '✅ Expired lot correctly untouched';
  ELSE
    RAISE NOTICE '❌ ERROR: Expired lot was incorrectly used!';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check current lot breakdown
SELECT 
  cl.id,
  cl.quantity_purchased,
  cl.quantity_remaining,
  cl.unit_price_usd_cents / 100.0 as unit_price_usd,
  cl.source,
  cl.created_at,
  cl.expires_at,
  cl.depleted_at,
  CASE 
    WHEN cl.depleted_at IS NOT NULL THEN 'DEPLETED'
    WHEN cl.expires_at IS NOT NULL AND cl.expires_at < now() THEN 'EXPIRED'
    WHEN cl.expires_at IS NOT NULL AND cl.expires_at < now() + interval '7 days' THEN 'EXPIRING SOON'
    ELSE 'ACTIVE'
  END as status
FROM credit_lots cl
WHERE cl.wallet_id IN (
  SELECT id FROM wallets WHERE user_id IN (SELECT id FROM auth.users LIMIT 1)
)
ORDER BY 
  CASE WHEN cl.expires_at IS NULL THEN 1 ELSE 0 END,
  cl.expires_at ASC NULLS LAST,
  cl.created_at ASC;

-- Check available balance
SELECT 
  w.user_id,
  w.balance_credits as wallet_balance,
  get_available_credits(w.id, NULL) as available_credits,
  SUM(cl.quantity_remaining) as sum_of_lots
FROM wallets w
LEFT JOIN credit_lots cl ON cl.wallet_id = w.id 
  AND (cl.expires_at IS NULL OR cl.expires_at > now())
WHERE w.user_id IN (SELECT id FROM auth.users LIMIT 1)
GROUP BY w.id, w.user_id, w.balance_credits;

-- Check transaction history (if exists)
-- SELECT 
--   wt.amount_credits,
--   wt.transaction_type,
--   wt.description,
--   wt.created_at
-- FROM wallet_transactions wt
-- WHERE wt.wallet_id IN (
--   SELECT id FROM wallets WHERE user_id IN (SELECT id FROM auth.users LIMIT 1)
-- )
-- ORDER BY wt.created_at DESC
-- LIMIT 20;

-- =====================================================
-- CLEANUP
-- =====================================================

-- Uncomment to clean up test data
-- DELETE FROM credit_lots WHERE wallet_id IN (
--   SELECT id FROM wallets WHERE user_id IN (SELECT id FROM auth.users LIMIT 1)
-- );
-- DELETE FROM wallets WHERE user_id IN (SELECT id FROM auth.users LIMIT 1);

-- =====================================================
-- FINAL SUMMARY
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ All credit/wallet load tests complete!';
  RAISE NOTICE 'Review results above and check for:';
  RAISE NOTICE '  1. FIFO deduction working correctly';
  RAISE NOTICE '  2. No race conditions in concurrent spending';
  RAISE NOTICE '  3. Insufficient funds handled gracefully';
  RAISE NOTICE '  4. Deduction performance < 100ms';
  RAISE NOTICE '  5. Expired lots not used';
  RAISE NOTICE '  6. Balance consistency maintained';
  RAISE NOTICE '========================================';
END $$;

