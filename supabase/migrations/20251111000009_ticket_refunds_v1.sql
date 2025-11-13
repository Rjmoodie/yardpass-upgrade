-- ============================================================================
-- TICKET REFUND SYSTEM v1 - Efficient & Simple
-- ============================================================================
-- Design: Stripe-driven, full-order refunds only, webhook-based automation
-- Idempotency: stripe_refund_id (unique per Stripe refund)
-- Business Rules: 24h window, no redeemed tickets, organizer/admin only
-- ============================================================================

-- ============================================================================
-- STEP 1: Add Refund Tracking Columns
-- ============================================================================

ALTER TABLE ticketing.tickets 
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

ALTER TABLE ticketing.orders
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_refunded 
ON ticketing.tickets(refunded_at) 
WHERE refunded_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_refunded 
ON ticketing.orders(refunded_at) 
WHERE refunded_at IS NOT NULL;

COMMENT ON COLUMN ticketing.tickets.refunded_at IS 'Timestamp when ticket was refunded (NULL = not refunded)';
COMMENT ON COLUMN ticketing.orders.refunded_at IS 'Timestamp when order was refunded (NULL = not refunded)';

-- ============================================================================
-- STEP 2: Create Refund Audit Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS ticketing.refund_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ticketing.orders(id) ON DELETE CASCADE,
  refund_amount_cents INTEGER NOT NULL CHECK (refund_amount_cents > 0),
  stripe_refund_id TEXT UNIQUE NOT NULL,  -- 🔑 Primary idempotency key
  stripe_event_id TEXT,                   -- Webhook event ID (for debugging)
  reason TEXT,                             -- Why refunded
  refund_type TEXT NOT NULL CHECK (refund_type IN ('admin', 'organizer', 'customer', 'dispute')),
  tickets_refunded INTEGER NOT NULL DEFAULT 0,
  inventory_released JSONB,               -- Which tiers got capacity back
  initiated_by UUID REFERENCES auth.users(id),  -- Who triggered it
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_refund_log_order ON ticketing.refund_log(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_log_stripe_refund ON ticketing.refund_log(stripe_refund_id);
CREATE INDEX IF NOT EXISTS idx_refund_log_processed ON ticketing.refund_log(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_log_type ON ticketing.refund_log(refund_type);

COMMENT ON TABLE ticketing.refund_log IS 
  'Audit trail for all ticket refunds. Idempotent via stripe_refund_id. Tracks who initiated, when, and inventory impact.';

GRANT SELECT ON ticketing.refund_log TO authenticated, service_role;
GRANT INSERT ON ticketing.refund_log TO service_role;

-- ============================================================================
-- STEP 3: Business Rules Configuration (Per-Event Policies)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ticketing.refund_policies (
  event_id UUID PRIMARY KEY REFERENCES events.events(id) ON DELETE CASCADE,
  allow_refunds BOOLEAN NOT NULL DEFAULT true,
  refund_window_hours INTEGER NOT NULL DEFAULT 24,  -- Hours before event
  refund_fees BOOLEAN NOT NULL DEFAULT true,        -- Liventix refunds platform fees
  partial_refunds_allowed BOOLEAN NOT NULL DEFAULT false,  -- v1 = false always
  auto_approve_enabled BOOLEAN NOT NULL DEFAULT false,  -- ✨ Organizer can toggle auto-approve
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_policies_event ON ticketing.refund_policies(event_id);

COMMENT ON TABLE ticketing.refund_policies IS 
  'Per-event refund policies. Defaults: allow refunds until 24h before event, refund platform fees, full-order only.';

COMMENT ON COLUMN ticketing.refund_policies.refund_window_hours IS 
  'Hours before event start when refunds are no longer allowed. Default: 24h. Admins can override.';

COMMENT ON COLUMN ticketing.refund_policies.refund_fees IS 
  'Whether Liventix platform fees are refunded. Default: true (we eat the fees for good UX).';

GRANT SELECT ON ticketing.refund_policies TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON ticketing.refund_policies TO authenticated, service_role;

-- ============================================================================
-- STEP 4: Core Refund Processing Function (Efficient v1)
-- ============================================================================

CREATE OR REPLACE FUNCTION ticketing.process_ticket_refund(
  p_order_id UUID,
  p_refund_amount_cents INTEGER,
  p_stripe_refund_id TEXT,
  p_stripe_event_id TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT 'Refund requested',
  p_refund_type TEXT DEFAULT 'admin',
  p_initiated_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ticketing, public
AS $$
DECLARE
  v_ticket_count INTEGER := 0;
  v_order RECORD;
  v_event RECORD;
  v_refund_window_hours INTEGER;
  v_tier_updates JSONB[];
  v_now TIMESTAMPTZ := now();
BEGIN
  -- ============================================================================
  -- 1. IDEMPOTENCY: Check stripe_refund_id (single source of truth)
  -- ============================================================================
  
  IF EXISTS (
    SELECT 1 FROM ticketing.refund_log 
    WHERE stripe_refund_id = p_stripe_refund_id
  ) THEN
    RETURN jsonb_build_object(
      'status', 'already_processed',
      'message', 'Refund already applied',
      'stripe_refund_id', p_stripe_refund_id
    );
  END IF;

  -- ============================================================================
  -- 2. VALIDATE ORDER EXISTS AND IS REFUNDABLE
  -- ============================================================================
  
  SELECT * INTO v_order
  FROM ticketing.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Order not found',
      'order_id', p_order_id
    );
  END IF;

  IF v_order.status = 'refunded' THEN
    RETURN jsonb_build_object(
      'status', 'already_refunded',
      'message', 'Order already refunded',
      'refunded_at', v_order.refunded_at
    );
  END IF;

  IF v_order.status != 'paid' THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Can only refund paid orders',
      'current_status', v_order.status
    );
  END IF;

  -- ============================================================================
  -- 3. CHECK BUSINESS RULES
  -- ============================================================================
  
  -- Get event details
  SELECT * INTO v_event
  FROM events.events
  WHERE id = v_order.event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Event not found for order'
    );
  END IF;

  -- Get refund policy (with default fallback)
  SELECT COALESCE(rp.refund_window_hours, 24) INTO v_refund_window_hours
  FROM ticketing.refund_policies rp
  WHERE rp.event_id = v_order.event_id;

  IF v_refund_window_hours IS NULL THEN
    v_refund_window_hours := 24;  -- System default
  END IF;

  -- ✅ BUSINESS RULE: No refunds within X hours of event start (unless admin override)
  IF v_event.start_at IS NOT NULL 
     AND v_event.start_at - v_now < make_interval(hours => v_refund_window_hours)
     AND p_refund_type NOT IN ('admin', 'dispute')  -- Admins and disputes can override
  THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', format('Refunds not allowed within %s hours of event start', v_refund_window_hours),
      'event_starts_at', v_event.start_at,
      'refund_window_hours', v_refund_window_hours
    );
  END IF;

  -- ============================================================================
  -- 4. MARK TICKETS AS REFUNDED (Simple & Efficient)
  -- ============================================================================
  
  WITH to_refund AS (
    SELECT id, tier_id
    FROM ticketing.tickets
    WHERE order_id = p_order_id
      AND status IN ('issued', 'transferred')  -- ✅ NEVER refund redeemed tickets (hard rule)
      AND refunded_at IS NULL
  )
  UPDATE ticketing.tickets
  SET 
    status = 'refunded',
    refunded_at = v_now
  WHERE id IN (SELECT id FROM to_refund);

  GET DIAGNOSTICS v_ticket_count = ROW_COUNT;

  IF v_ticket_count = 0 THEN
    RETURN jsonb_build_object(
      'status', 'no_refundable_tickets',
      'message', 'No refundable tickets found (all redeemed or already refunded)',
      'order_id', p_order_id
    );
  END IF;

  -- ============================================================================
  -- 5. RELEASE INVENTORY (Decrement issued_quantity by tier)
  -- ============================================================================
  
  WITH refund_by_tier AS (
    SELECT 
      tier_id,
      COUNT(*) as refund_count
    FROM ticketing.tickets
    WHERE order_id = p_order_id
      AND status = 'refunded'
      AND refunded_at = v_now  -- Only tickets we just refunded
    GROUP BY tier_id
  ),
  updated_tiers AS (
    UPDATE ticketing.ticket_tiers tt
    SET 
      issued_quantity = GREATEST(0, issued_quantity - rbt.refund_count),
      updated_at = v_now
    FROM refund_by_tier rbt
    WHERE tt.id = rbt.tier_id
    RETURNING jsonb_build_object(
      'tier_id', tt.id,
      'tier_name', tt.name,
      'tickets_released', rbt.refund_count,
      'new_issued_quantity', GREATEST(0, tt.issued_quantity - rbt.refund_count)
    )
  )
  SELECT array_agg(ut.jsonb_build_object) INTO v_tier_updates
  FROM updated_tiers ut;

  -- ============================================================================
  -- 6. UPDATE ORDER STATUS
  -- ============================================================================
  
  UPDATE ticketing.orders
  SET 
    status = 'refunded',
    refunded_at = v_now,
    updated_at = v_now
  WHERE id = p_order_id;

  -- ============================================================================
  -- 7. LOG REFUND (Audit Trail + Idempotency Source)
  -- ============================================================================
  
  INSERT INTO ticketing.refund_log (
    order_id,
    refund_amount_cents,
    stripe_refund_id,
    stripe_event_id,
    reason,
    refund_type,
    tickets_refunded,
    inventory_released,
    initiated_by,
    processed_at,
    metadata
  ) VALUES (
    p_order_id,
    p_refund_amount_cents,
    p_stripe_refund_id,
    p_stripe_event_id,
    p_reason,
    p_refund_type,
    v_ticket_count,
    to_jsonb(v_tier_updates),
    p_initiated_by,
    v_now,
    jsonb_build_object(
      'event_id', v_order.event_id,
      'event_title', v_event.title,
      'event_start_at', v_event.start_at,
      'refund_window_hours', v_refund_window_hours,
      'order_total_cents', v_order.total_cents
    )
  );

  -- ============================================================================
  -- 8. RETURN SUCCESS
  -- ============================================================================
  
  RETURN jsonb_build_object(
    'status', 'success',
    'tickets_refunded', v_ticket_count,
    'amount_refunded_cents', p_refund_amount_cents,
    'inventory_released', to_jsonb(v_tier_updates),
    'order_id', p_order_id,
    'event_title', v_event.title,
    'processed_at', v_now
  );
END;
$$;

COMMENT ON FUNCTION ticketing.process_ticket_refund IS 
  'v1: Full-order ticket refunds only. Idempotent via stripe_refund_id. Enforces: no redeemed tickets, respects 24h window, releases inventory.';

GRANT EXECUTE ON FUNCTION ticketing.process_ticket_refund TO service_role;

-- ============================================================================
-- STEP 5: Helper Function - Check Refund Eligibility
-- ============================================================================

CREATE OR REPLACE FUNCTION ticketing.check_refund_eligibility(
  p_order_id UUID,
  p_user_id UUID DEFAULT NULL  -- NULL = skip auth check (for webhook/admin)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ticketing, public
AS $$
DECLARE
  v_order RECORD;
  v_event RECORD;
  v_refund_window_hours INTEGER;
  v_is_organizer BOOLEAN := false;
  v_is_admin BOOLEAN := false;
  v_refundable_count INTEGER;
BEGIN
  -- Get order
  SELECT * INTO v_order
  FROM ticketing.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Order not found');
  END IF;

  IF v_order.status = 'refunded' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Already refunded', 'refunded_at', v_order.refunded_at);
  END IF;

  IF v_order.status != 'paid' THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Order not paid', 'status', v_order.status);
  END IF;

  -- Get event
  SELECT * INTO v_event
  FROM events.events
  WHERE id = v_order.event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'Event not found');
  END IF;

  -- Get refund window (default 24h if no policy set)
  SELECT COALESCE(rp.refund_window_hours, 24) INTO v_refund_window_hours
  FROM ticketing.refund_policies rp
  WHERE rp.event_id = v_order.event_id;

  IF v_refund_window_hours IS NULL THEN
    v_refund_window_hours := 24;
  END IF;

  -- Check if user can override refund window
  IF p_user_id IS NOT NULL THEN
    -- Check platform admin
    SELECT COALESCE(is_admin, false) INTO v_is_admin
    FROM users.user_profiles
    WHERE user_id = p_user_id;

    -- Check if event organizer
    v_is_organizer := (v_event.created_by = p_user_id);
  END IF;

  -- Check refund window (unless admin/organizer override)
  IF v_event.start_at IS NOT NULL 
     AND v_event.start_at - now() < make_interval(hours => v_refund_window_hours)
     AND NOT v_is_admin 
     AND NOT v_is_organizer
  THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', format('Refunds not allowed within %s hours of event start', v_refund_window_hours),
      'refund_window_hours', v_refund_window_hours,
      'event_starts_at', v_event.start_at
    );
  END IF;

  -- Check if any tickets are refundable
  SELECT COUNT(*) INTO v_refundable_count
  FROM ticketing.tickets
  WHERE order_id = p_order_id
    AND status IN ('issued', 'transferred')
    AND refunded_at IS NULL;

  IF v_refundable_count = 0 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'No refundable tickets (all redeemed or already refunded)'
    );
  END IF;

  -- ✅ All checks passed
  RETURN jsonb_build_object(
    'eligible', true,
    'refund_amount_cents', v_order.total_cents,
    'refundable_tickets', v_refundable_count,
    'refund_window_hours', v_refund_window_hours,
    'event_starts_at', v_event.start_at,
    'can_override_window', v_is_admin OR v_is_organizer
  );
END;
$$;

COMMENT ON FUNCTION ticketing.check_refund_eligibility IS 
  'Check if an order is eligible for refund. Returns eligibility boolean + reason. Respects business rules and permissions.';

GRANT EXECUTE ON FUNCTION ticketing.check_refund_eligibility TO authenticated, service_role;

-- ============================================================================
-- STEP 6: Create View for Easy Refund Queries
-- ============================================================================

CREATE OR REPLACE VIEW public.refund_log AS
SELECT 
  rl.id,
  rl.order_id,
  rl.refund_amount_cents,
  rl.refund_amount_cents / 100.0 as refund_amount_usd,
  rl.stripe_refund_id,
  rl.stripe_event_id,
  rl.reason,
  rl.refund_type,
  rl.tickets_refunded,
  rl.inventory_released,
  rl.initiated_by,
  rl.processed_at,
  rl.metadata,
  -- Join order details
  o.user_id as order_user_id,
  o.event_id,
  o.contact_email,
  -- Join event details
  e.title as event_title,
  e.start_at as event_start_at,
  -- Join initiator details
  up.display_name as initiated_by_name
FROM ticketing.refund_log rl
LEFT JOIN ticketing.orders o ON o.id = rl.order_id
LEFT JOIN events.events e ON e.id = o.event_id
LEFT JOIN users.user_profiles up ON up.user_id = rl.initiated_by
WHERE (
  -- Users can see their own refunds
  o.user_id = auth.uid()
  -- Event organizers can see refunds for their events
  OR e.created_by = auth.uid()
  -- Service role sees all
  OR auth.uid() IS NULL
);

COMMENT ON VIEW public.refund_log IS 
  'Refund audit log with order and event details. RLS: users see their own, organizers see their events.';

GRANT SELECT ON public.refund_log TO authenticated, service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Ticket refund system v1: Full-order refunds, Stripe-driven automation, 
-- idempotent via stripe_refund_id, 24h window, no redeemed tickets.

