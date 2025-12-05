-- ============================================================================
-- PRODUCTION-GRADE TICKET ACCOUNTING REPAIR & MAINTENANCE
-- Version: 2.0 (Hardened)
-- Created: 2025-12-04
-- ============================================================================
-- 
-- FEATURES:
-- ✅ Idempotent (safe to run multiple times)
-- ✅ Parameterized (no hardcoded event IDs)
-- ✅ Soft deletes (preserves audit trail)
-- ✅ Dry-run mode (verify before committing)
-- ✅ Performance optimized (uses indexes)
-- ✅ Observability (detailed logging)
-- ✅ Safety rails (constraints & checks)
--
-- USAGE:
--   1. Review parameters in WITH clause
--   2. Run in DRY_RUN mode first (set p_dry_run = true)
--   3. Review output, then set p_dry_run = false
--   4. Run again to execute changes
--   5. Verify results
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: REQUIRED INDEXES (if not exists)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ticket_holds_tier_status_expires 
  ON ticketing.ticket_holds (tier_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event 
  ON ticketing.ticket_tiers (event_id);

CREATE INDEX IF NOT EXISTS idx_orders_event_status_created 
  ON ticketing.orders (event_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_tickets_tier_status 
  ON ticketing.tickets (tier_id, status);

CREATE INDEX IF NOT EXISTS idx_order_items_order 
  ON ticketing.order_items (order_id);

-- ============================================================================
-- PART 2: DATA INVARIANT CONSTRAINTS
-- ============================================================================

-- Add constraints if they don't exist (use DO block to avoid errors)
DO $$
BEGIN
  -- Ensure reserved + issued never exceeds total
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tiers_capacity_invariant'
  ) THEN
    ALTER TABLE ticketing.ticket_tiers
    ADD CONSTRAINT tiers_capacity_invariant 
    CHECK (quantity >= (COALESCE(issued_quantity, 0) + COALESCE(reserved_quantity, 0)));
  END IF;

  -- Ensure all quantities are non-negative
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tiers_non_negative'
  ) THEN
    ALTER TABLE ticketing.ticket_tiers
    ADD CONSTRAINT tiers_non_negative 
    CHECK (
      quantity >= 0 
      AND issued_quantity >= 0 
      AND reserved_quantity >= 0
    );
  END IF;
END $$;

-- ============================================================================
-- PART 3: HEALTH CHECK VIEW
-- ============================================================================

CREATE OR REPLACE VIEW ticketing.event_health AS
SELECT
  tt.event_id,
  e.title as event_title,
  -- Count tiers with suspicious reserved quantities
  COUNT(CASE WHEN tt.reserved_quantity > tt.quantity * 0.3 THEN 1 END) AS suspicious_high_reserved_tiers,
  -- Count tiers with more reserved+issued than total (broken invariant)
  COUNT(CASE WHEN (tt.reserved_quantity + tt.issued_quantity) > tt.quantity THEN 1 END) AS broken_invariant_tiers,
  -- Count old pending orders
  (SELECT COUNT(*) 
   FROM ticketing.orders o 
   WHERE o.event_id = tt.event_id 
     AND o.status = 'pending' 
     AND o.created_at < NOW() - INTERVAL '20 minutes') AS stale_pending_orders,
  -- Count paid orders without tickets
  (SELECT COUNT(*) 
   FROM ticketing.orders o 
   WHERE o.event_id = tt.event_id 
     AND o.status = 'paid'
     AND NOT EXISTS (
       SELECT 1 FROM ticketing.tickets t WHERE t.order_id = o.id
     )) AS paid_orders_missing_tickets,
  -- Count expired holds still marked as active
  (SELECT COUNT(*)
   FROM ticketing.ticket_holds th
   JOIN ticketing.ticket_tiers tt2 ON tt2.id = th.tier_id
   WHERE tt2.event_id = tt.event_id
     AND th.expires_at < NOW()
     AND th.status = 'active') AS expired_active_holds,
  -- Overall health score (0 = healthy, > 0 = issues)
  GREATEST(
    COUNT(CASE WHEN tt.reserved_quantity > tt.quantity * 0.3 THEN 1 END),
    COUNT(CASE WHEN (tt.reserved_quantity + tt.issued_quantity) > tt.quantity THEN 1 END)
  ) AS health_score
FROM ticketing.ticket_tiers tt
JOIN events.events e ON e.id = tt.event_id
GROUP BY tt.event_id, e.title;

COMMENT ON VIEW ticketing.event_health IS 'Real-time health monitoring for ticket accounting. health_score > 0 indicates issues requiring attention.';

GRANT SELECT ON ticketing.event_health TO authenticated, anon;

-- ============================================================================
-- PART 4: SOFT-DELETE CLEANUP FUNCTION (Improved)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_ticket_holds(
  p_event_id UUID DEFAULT NULL,
  p_dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE(
  action TEXT,
  holds_affected INTEGER,
  tiers_updated INTEGER,
  sample_holds TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_holds_count INTEGER := 0;
  v_tiers_count INTEGER := 0;
  v_sample TEXT[];
BEGIN
  -- Find expired holds
  SELECT 
    COUNT(*),
    ARRAY_AGG(th.id::text ORDER BY th.created_at DESC LIMIT 20)
  INTO v_holds_count, v_sample
  FROM ticketing.ticket_holds th
  JOIN ticketing.ticket_tiers tt ON tt.id = th.tier_id
  WHERE th.expires_at < NOW()
    AND th.status = 'active'
    AND (p_event_id IS NULL OR tt.event_id = p_event_id);

  -- DRY RUN: Just return what would happen
  IF p_dry_run THEN
    RETURN QUERY SELECT 
      '[DRY RUN] Would expire holds'::text,
      v_holds_count,
      0,
      v_sample;
    RETURN;
  END IF;

  -- ACTUAL RUN: Soft-delete expired holds
  UPDATE ticketing.ticket_holds th
  SET status = 'expired',
      updated_at = NOW()
  FROM ticketing.ticket_tiers tt
  WHERE th.tier_id = tt.id
    AND th.expires_at < NOW()
    AND th.status = 'active'
    AND (p_event_id IS NULL OR tt.event_id = p_event_id);

  GET DIAGNOSTICS v_holds_count = ROW_COUNT;

  -- Recalculate reserved_quantity for affected tiers
  WITH affected_tiers AS (
    SELECT DISTINCT tt.id
    FROM ticketing.ticket_tiers tt
    WHERE (p_event_id IS NULL OR tt.event_id = p_event_id)
  )
  UPDATE ticketing.ticket_tiers tt
  SET reserved_quantity = COALESCE((
    SELECT SUM(th.quantity)
    FROM ticketing.ticket_holds th
    WHERE th.tier_id = tt.id
      AND th.status = 'active'
      AND th.expires_at > NOW()
  ), 0)
  FROM affected_tiers at
  WHERE tt.id = at.id;

  GET DIAGNOSTICS v_tiers_count = ROW_COUNT;

  -- Log the action
  RAISE LOG 'cleanup_expired_ticket_holds: expired % holds, updated % tiers (event_id: %, dry_run: %)', 
    v_holds_count, v_tiers_count, p_event_id, p_dry_run;

  -- Return summary
  RETURN QUERY SELECT 
    '✅ Expired holds'::text,
    v_holds_count,
    v_tiers_count,
    v_sample;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_ticket_holds IS 
'Soft-deletes expired ticket holds and recalculates reserved_quantity. 
 Supports dry-run mode and event-specific or global cleanup.
 Safe to run repeatedly (idempotent).';

GRANT EXECUTE ON FUNCTION public.cleanup_expired_ticket_holds TO authenticated, service_role;

-- ============================================================================
-- PART 5: EXPIRE PENDING ORDERS FUNCTION (Hardened)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.expire_pending_orders(
  p_event_id UUID DEFAULT NULL,
  p_timeout_minutes INTEGER DEFAULT 15,
  p_dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE(
  action TEXT,
  orders_affected INTEGER,
  sample_orders TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_count INTEGER := 0;
  v_sample TEXT[];
BEGIN
  -- Find old pending orders
  SELECT 
    COUNT(*),
    ARRAY_AGG(o.id::text ORDER BY o.created_at DESC LIMIT 20)
  INTO v_order_count, v_sample
  FROM ticketing.orders o
  WHERE o.status = 'pending'
    AND o.created_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL
    AND (p_event_id IS NULL OR o.event_id = p_event_id);

  -- DRY RUN: Just return what would happen
  IF p_dry_run THEN
    RETURN QUERY SELECT 
      format('[DRY RUN] Would expire %s orders older than %s minutes', v_order_count, p_timeout_minutes)::text,
      v_order_count,
      v_sample;
    RETURN;
  END IF;

  -- ACTUAL RUN: Expire old pending orders
  UPDATE ticketing.orders
  SET status = 'expired',
      updated_at = NOW(),
      metadata = COALESCE(metadata, '{}'::jsonb) || 
        jsonb_build_object('expired_at', NOW(), 'expired_by', 'auto_cleanup')
  WHERE status = 'pending'
    AND created_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL
    AND (p_event_id IS NULL OR event_id = p_event_id);

  GET DIAGNOSTICS v_order_count = ROW_COUNT;

  -- Log the action
  RAISE LOG 'expire_pending_orders: expired % orders (event_id: %, timeout: %min, dry_run: %)', 
    v_order_count, p_event_id, p_timeout_minutes, p_dry_run;

  -- Return summary
  RETURN QUERY SELECT 
    format('✅ Expired %s pending orders', v_order_count)::text,
    v_order_count,
    v_sample;
END;
$$;

COMMENT ON FUNCTION public.expire_pending_orders IS 
'Expires pending orders older than timeout threshold.
 Supports dry-run mode and event-specific or global cleanup.
 Safe to run repeatedly (idempotent).
 Adds metadata tracking when order was expired.';

GRANT EXECUTE ON FUNCTION public.expire_pending_orders TO authenticated, service_role;

-- ============================================================================
-- PART 6: RECONCILE ISSUED QUANTITY FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reconcile_issued_quantity(
  p_event_id UUID DEFAULT NULL,
  p_dry_run BOOLEAN DEFAULT false
)
RETURNS TABLE(
  action TEXT,
  tier_id UUID,
  tier_name TEXT,
  old_issued INTEGER,
  new_issued INTEGER,
  difference INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier RECORD;
  v_actual_count INTEGER;
BEGIN
  FOR v_tier IN
    SELECT 
      tt.id,
      tt.name,
      tt.issued_quantity,
      (SELECT COUNT(*)
       FROM ticketing.tickets t
       WHERE t.tier_id = tt.id
         AND t.status IN ('issued', 'transferred', 'redeemed')) as actual_issued
    FROM ticketing.ticket_tiers tt
    WHERE (p_event_id IS NULL OR tt.event_id = p_event_id)
  LOOP
    v_actual_count := v_tier.actual_issued;

    -- DRY RUN: Just return what would change
    IF p_dry_run THEN
      IF v_tier.issued_quantity != v_actual_count THEN
        RETURN QUERY SELECT
          '[DRY RUN] Would update'::text,
          v_tier.id,
          v_tier.name,
          v_tier.issued_quantity,
          v_actual_count,
          v_actual_count - v_tier.issued_quantity;
      END IF;
      CONTINUE;
    END IF;

    -- ACTUAL RUN: Update if different
    IF v_tier.issued_quantity != v_actual_count THEN
      UPDATE ticketing.ticket_tiers
      SET issued_quantity = v_actual_count,
          updated_at = NOW()
      WHERE id = v_tier.id;

      RAISE LOG 'reconcile_issued_quantity: tier % changed from % to % tickets',
        v_tier.name, v_tier.issued_quantity, v_actual_count;

      RETURN QUERY SELECT
        '✅ Updated'::text,
        v_tier.id,
        v_tier.name,
        v_tier.issued_quantity,
        v_actual_count,
        v_actual_count - v_tier.issued_quantity;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.reconcile_issued_quantity IS 
'Reconciles issued_quantity column with actual ticket count from tickets table.
 Supports dry-run mode to preview changes.
 Safe to run repeatedly.';

GRANT EXECUTE ON FUNCTION public.reconcile_issued_quantity TO authenticated, service_role;

-- ============================================================================
-- PART 7: MASTER RECONCILIATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reconcile_event_tickets(
  p_event_id UUID,
  p_dry_run BOOLEAN DEFAULT true  -- Default to dry-run for safety!
)
RETURNS TABLE(
  step INTEGER,
  action TEXT,
  status TEXT,
  details JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mode TEXT;
  v_holds_cleaned INTEGER := 0;
  v_orders_expired INTEGER := 0;
  v_tiers_synced INTEGER := 0;
BEGIN
  v_mode := CASE WHEN p_dry_run THEN '🔍 DRY RUN MODE' ELSE '🔧 EXECUTION MODE' END;
  
  RAISE LOG 'reconcile_event_tickets: Starting for event % (dry_run: %)', p_event_id, p_dry_run;

  -- STEP 1: Event validation
  IF NOT EXISTS (SELECT 1 FROM events.events WHERE id = p_event_id) THEN
    RETURN QUERY SELECT 
      1,
      '❌ Event not found'::text,
      'ERROR'::text,
      jsonb_build_object('event_id', p_event_id);
    RETURN;
  END IF;

  RETURN QUERY SELECT 
    1,
    format('%s - Event validated', v_mode)::text,
    'INFO'::text,
    jsonb_build_object('event_id', p_event_id);

  -- STEP 2: Clean up expired holds
  DECLARE
    v_cleanup_result RECORD;
  BEGIN
    SELECT * INTO v_cleanup_result
    FROM public.cleanup_expired_ticket_holds(p_event_id, p_dry_run)
    LIMIT 1;

    RETURN QUERY SELECT 
      2,
      'Expired holds cleanup'::text,
      CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'COMPLETED' END::text,
      jsonb_build_object(
        'holds_affected', v_cleanup_result.holds_affected,
        'tiers_updated', v_cleanup_result.tiers_updated
      );
  END;

  -- STEP 3: Expire pending orders
  DECLARE
    v_expire_result RECORD;
  BEGIN
    SELECT * INTO v_expire_result
    FROM public.expire_pending_orders(p_event_id, 15, p_dry_run)
    LIMIT 1;

    RETURN QUERY SELECT 
      3,
      'Pending orders expiration'::text,
      CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'COMPLETED' END::text,
      jsonb_build_object('orders_expired', v_expire_result.orders_affected);
  END;

  -- STEP 4: Reconcile issued quantities
  DECLARE
    v_reconcile_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_reconcile_count
    FROM public.reconcile_issued_quantity(p_event_id, p_dry_run);

    RETURN QUERY SELECT 
      4,
      'Issued quantity reconciliation'::text,
      CASE WHEN p_dry_run THEN 'DRY_RUN' ELSE 'COMPLETED' END::text,
      jsonb_build_object('tiers_synced', v_reconcile_count);
  END;

  -- STEP 5: Final state summary
  RETURN QUERY 
  SELECT 
    5,
    'Final state'::text,
    'SUMMARY'::text,
    jsonb_agg(
      jsonb_build_object(
        'tier_name', tt.name,
        'total', tt.quantity,
        'reserved', tt.reserved_quantity,
        'issued', tt.issued_quantity,
        'available', (tt.quantity - tt.reserved_quantity - tt.issued_quantity),
        'health', CASE 
          WHEN (tt.quantity - tt.reserved_quantity - tt.issued_quantity) < 0 THEN '❌ NEGATIVE'
          WHEN tt.reserved_quantity > tt.quantity * 0.3 THEN '⚠️ HIGH_RESERVED'
          ELSE '✅ OK'
        END
      )
    )
  FROM ticketing.ticket_tiers tt
  WHERE tt.event_id = p_event_id
  GROUP BY 1;

  RAISE LOG 'reconcile_event_tickets: Completed for event % (dry_run: %)', p_event_id, p_dry_run;
END;
$$;

COMMENT ON FUNCTION public.reconcile_event_tickets IS 
'Master function to reconcile all ticket accounting for an event.
 Runs cleanup, expiration, and sync in correct order.
 ALWAYS defaults to dry-run mode for safety.
 Usage:
   -- Preview changes:
   SELECT * FROM public.reconcile_event_tickets(''event-uuid'', true);
   -- Execute changes:
   SELECT * FROM public.reconcile_event_tickets(''event-uuid'', false);
';

GRANT EXECUTE ON FUNCTION public.reconcile_event_tickets TO authenticated, service_role;

-- ============================================================================
-- PART 8: SCHEDULE MAINTENANCE JOBS
-- ============================================================================

-- Only schedule if pg_cron extension is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Cleanup expired holds every 5 minutes (global)
    PERFORM cron.schedule(
      'cleanup-expired-ticket-holds',
      '*/5 * * * *',
      $$SELECT public.cleanup_expired_ticket_holds(NULL, false)$$
    );

    -- Expire pending orders every 5 minutes (global)
    PERFORM cron.schedule(
      'expire-pending-orders',
      '*/5 * * * *',
      $$SELECT public.expire_pending_orders(NULL, 15, false)$$
    );

    -- Daily health check (logs to Postgres logs)
    PERFORM cron.schedule(
      'daily-ticket-health-check',
      '0 9 * * *',  -- 9 AM daily
      $$
        SELECT 
          RAISE LOG 'TICKET_HEALTH_CHECK: event % has health_score %', 
          event_id, health_score
        FROM ticketing.event_health
        WHERE health_score > 0;
      $$
    );

    RAISE NOTICE '✅ Cron jobs scheduled successfully';
  ELSE
    RAISE WARNING '⚠️ pg_cron extension not found - jobs NOT scheduled';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '⚠️ Could not schedule cron jobs: %', SQLERRM;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run after migration)
-- ============================================================================

-- Check cron jobs
SELECT jobid, schedule, command FROM cron.job 
WHERE jobname LIKE '%ticket%' OR jobname LIKE '%pending%';

-- Check health view
SELECT * FROM ticketing.event_health 
WHERE health_score > 0 
ORDER BY health_score DESC;

-- Test dry-run mode for Liventix Official Event
SELECT * FROM public.reconcile_event_tickets(
  '28309929-28e7-4bda-af28-6e0b47485ce1'::uuid,
  true  -- dry-run
);

