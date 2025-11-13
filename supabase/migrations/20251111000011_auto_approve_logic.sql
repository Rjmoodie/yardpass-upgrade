-- ============================================================================
-- AUTO-APPROVE LOGIC FOR REFUND REQUESTS
-- ============================================================================
-- Checks if refund request meets safety criteria for auto-approval
-- Controlled by refund_policies.auto_approve_enabled toggle
-- ============================================================================

CREATE OR REPLACE FUNCTION ticketing.should_auto_approve_refund(
  p_order_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ticketing, public
AS $$
DECLARE
  v_order RECORD;
  v_event RECORD;
  v_policy RECORD;
  v_recent_refunds INTEGER;
  v_hours_until_event NUMERIC;
  v_redeemed_count INTEGER;
  v_order_age_days NUMERIC;
BEGIN
  -- ============================================================================
  -- Get order, event, and policy
  -- ============================================================================
  
  SELECT * INTO v_order
  FROM ticketing.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('auto_approve', false, 'reason', 'Order not found');
  END IF;

  SELECT * INTO v_event
  FROM events.events
  WHERE id = v_order.event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('auto_approve', false, 'reason', 'Event not found');
  END IF;

  -- Get refund policy (with defaults if no policy set)
  SELECT 
    COALESCE(rp.auto_approve_enabled, false) as auto_approve_enabled,
    COALESCE(rp.refund_window_hours, 24) as refund_window_hours
  INTO v_policy
  FROM ticketing.refund_policies rp
  WHERE rp.event_id = v_order.event_id;

  -- If no policy exists, use defaults
  IF v_policy IS NULL THEN
    v_policy := ROW(false, 24);
  END IF;

  -- ============================================================================
  -- CHECK 1: Auto-approve must be enabled for this event
  -- ============================================================================
  
  IF COALESCE(v_policy.auto_approve_enabled, false) = false THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', 'Auto-approve is disabled for this event',
      'requires_manual_review', true
    );
  END IF;

  -- ============================================================================
  -- CHECK 2: No redeemed tickets (hard rule)
  -- ============================================================================
  
  SELECT COUNT(*) INTO v_redeemed_count
  FROM ticketing.tickets
  WHERE order_id = p_order_id
    AND status = 'redeemed';

  IF v_redeemed_count > 0 THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', format('%s tickets already redeemed - requires manual review', v_redeemed_count),
      'requires_manual_review', true
    );
  END IF;

  -- ============================================================================
  -- CHECK 3: Event is more than 48h away (safety buffer)
  -- ============================================================================
  
  v_hours_until_event := EXTRACT(EPOCH FROM (v_event.start_at - now())) / 3600;

  IF v_hours_until_event < 48 THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', format('Event starts in %.1f hours (auto-approve threshold: 48h)', v_hours_until_event),
      'hours_until_event', ROUND(v_hours_until_event::numeric, 1),
      'requires_manual_review', true
    );
  END IF;

  -- ============================================================================
  -- CHECK 4: Order is recent (< 30 days old)
  -- ============================================================================
  
  v_order_age_days := EXTRACT(EPOCH FROM (now() - v_order.created_at)) / 86400;

  IF v_order_age_days > 30 THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', format('Order is %.0f days old (auto-approve limit: 30 days)', v_order_age_days),
      'order_age_days', ROUND(v_order_age_days::numeric, 0),
      'requires_manual_review', true
    );
  END IF;

  -- ============================================================================
  -- CHECK 5: Customer refund history (fraud prevention)
  -- ============================================================================
  
  SELECT COUNT(*) INTO v_recent_refunds
  FROM ticketing.refund_log rl
  JOIN ticketing.orders o ON o.id = rl.order_id
  WHERE o.user_id = p_user_id
    AND rl.processed_at > now() - interval '90 days';

  IF v_recent_refunds >= 3 THEN
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', format('Customer has %s refunds in last 90 days - requires manual review', v_recent_refunds),
      'recent_refunds', v_recent_refunds,
      'requires_manual_review', true
    );
  END IF;

  -- ============================================================================
  -- CHECK 6: Order amount is reasonable (< $500 for safety)
  -- ============================================================================
  
  IF v_order.total_cents > 50000 THEN  -- $500
    RETURN jsonb_build_object(
      'auto_approve', false,
      'reason', format('High value order ($%.2f) - requires manual review', v_order.total_cents / 100.0),
      'order_amount_usd', v_order.total_cents / 100.0,
      'requires_manual_review', true
    );
  END IF;

  -- ============================================================================
  -- ✅ ALL CHECKS PASSED - Safe to auto-approve
  -- ============================================================================
  
  RETURN jsonb_build_object(
    'auto_approve', true,
    'reason', 'Meets all auto-approval safety criteria',
    'requires_manual_review', false,
    'checks_passed', jsonb_build_object(
      'auto_approve_enabled', true,
      'no_redeemed_tickets', true,
      'hours_until_event', ROUND(v_hours_until_event::numeric, 1),
      'order_age_days', ROUND(v_order_age_days::numeric, 0),
      'customer_recent_refunds', v_recent_refunds,
      'order_amount_usd', v_order.total_cents / 100.0
    )
  );
END;
$$;

COMMENT ON FUNCTION ticketing.should_auto_approve_refund IS 
  'Checks if refund request meets safety criteria for auto-approval based on event policy and fraud rules.';

GRANT EXECUTE ON FUNCTION ticketing.should_auto_approve_refund TO authenticated, service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Auto-approve logic: checks event policy toggle + 5 safety rules


