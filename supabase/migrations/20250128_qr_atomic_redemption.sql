-- ============================================================================
-- QR Code Security Enhancements - Step 1: Atomic Redemption Function
-- Phase 2.2.1: Add explicit row locking (SELECT FOR UPDATE) for ticket redemption
-- ============================================================================

-- Create atomic ticket redemption function with SELECT FOR UPDATE
-- This provides explicit row locking to prevent any race conditions
-- Both legacy 8-char codes and signed tokens will use this function

CREATE OR REPLACE FUNCTION public.redeem_ticket_atomic(
  p_ticket_id UUID,
  p_scanner_user_id UUID,
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, events, ticketing, extensions
AS $$
DECLARE
  v_ticket RECORD;
  v_event_end_at TIMESTAMPTZ;
  v_redeemed_at TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- Start explicit transaction with row locking
  -- SELECT FOR UPDATE locks the row until transaction commits/rolls back
  SELECT 
    t.id,
    t.event_id,
    t.status,
    t.redeemed_at,
    t.owner_user_id,
    t.tier_id,
    t.qr_code
  INTO v_ticket
  FROM ticketing.tickets t
  WHERE t.id = p_ticket_id
  FOR UPDATE; -- Explicit row lock - prevents concurrent modifications

  -- Ticket doesn't exist
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'result', 'invalid',
      'status', 'NOT_FOUND',
      'message', 'Ticket not found'
    );
  END IF;

  -- Wrong event
  IF v_ticket.event_id != p_event_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'result', 'wrong_event',
      'status', 'WRONG_EVENT',
      'message', 'Ticket is for a different event'
    );
  END IF;

  -- Already redeemed (check within locked transaction)
  IF v_ticket.redeemed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'result', 'duplicate',
      'status', 'ALREADY_REDEEMED',
      'message', format('Already scanned at %s', v_ticket.redeemed_at),
      'timestamp', v_ticket.redeemed_at::text
    );
  END IF;

  -- Check status
  IF v_ticket.status = 'refunded' THEN
    RETURN jsonb_build_object(
      'success', false,
      'result', 'refunded',
      'status', 'INVALID_STATE',
      'message', 'Ticket has been refunded'
    );
  END IF;

  IF v_ticket.status = 'void' THEN
    RETURN jsonb_build_object(
      'success', false,
      'result', 'void',
      'status', 'INVALID_STATE',
      'message', 'Ticket is void'
    );
  END IF;

  -- Check if event has ended (only for expired rejections)
  SELECT end_at INTO v_event_end_at
  FROM events.events
  WHERE id = p_event_id;

  IF v_event_end_at IS NOT NULL AND v_event_end_at < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'result', 'expired',
      'status', 'INVALID_STATE',
      'message', 'Event has ended'
    );
  END IF;

  -- Redemption successful - update ticket atomically
  v_redeemed_at := now();
  
  UPDATE ticketing.tickets
  SET 
    redeemed_at = v_redeemed_at,
    status = 'redeemed',
    updated_at = v_redeemed_at
  WHERE id = p_ticket_id;

  -- Return success with ticket info
  RETURN jsonb_build_object(
    'success', true,
    'result', 'valid',
    'status', 'REDEEMED',
    'message', 'Ticket validated',
    'timestamp', v_redeemed_at::text,
    'ticket_id', v_ticket.id,
    'qr_code', v_ticket.qr_code
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log error and return failure
    RAISE WARNING 'Error in redeem_ticket_atomic: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'result', 'invalid',
      'status', 'ERROR',
      'message', 'Database error during redemption'
    );
END;
$$;

COMMENT ON FUNCTION public.redeem_ticket_atomic IS 
'Atomically redeem a ticket with explicit row locking (SELECT FOR UPDATE). 
Prevents race conditions. Returns structured status: REDEEMED, ALREADY_REDEEMED, 
NOT_FOUND, WRONG_EVENT, INVALID_STATE, or ERROR. Both legacy and signed codes 
should use this function for consistent redemption behavior.';

GRANT EXECUTE ON FUNCTION public.redeem_ticket_atomic TO service_role, authenticated;

-- ============================================================================
-- Helper function to detect scan anomalies (for Step 4)
-- ============================================================================

-- Function to detect scan anomalies (rapid re-scans, old timestamps)
CREATE OR REPLACE FUNCTION public.detect_scan_anomaly(
  p_ticket_id UUID,
  p_token_age_seconds INT DEFAULT NULL,
  p_last_scan_seconds_ago INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_recent_scans INT;
  v_anomaly_type TEXT;
  v_anomaly_score INT := 0;
  v_anomaly_flags TEXT[] := ARRAY[]::TEXT[];
  v_result JSONB;
BEGIN
  -- Check for rapid re-scans (multiple scans in last 10 seconds)
  SELECT COUNT(*)
  INTO v_recent_scans
  FROM ticketing.scan_logs
  WHERE ticket_id = p_ticket_id
    AND created_at > now() - INTERVAL '10 seconds'
    AND result IN ('valid', 'duplicate');

  IF v_recent_scans > 3 THEN
    v_anomaly_type := 'rapid_rescans';
    v_anomaly_score := v_anomaly_score + 50;
    v_anomaly_flags := array_append(v_anomaly_flags, 'rapid_rescan');
  END IF;

  -- Check for old token scan (potential replay)
  IF p_token_age_seconds IS NOT NULL AND p_token_age_seconds > 300 THEN -- > 5 minutes
    IF v_anomaly_type IS NULL THEN
      v_anomaly_type := 'old_token_scan';
    END IF;
    v_anomaly_score := v_anomaly_score + 30;
    v_anomaly_flags := array_append(v_anomaly_flags, 'old_iat');
  END IF;

  -- Check for suspicious scan frequency
  IF p_last_scan_seconds_ago IS NOT NULL AND p_last_scan_seconds_ago < 5 THEN
    IF v_anomaly_type IS NULL THEN
      v_anomaly_type := 'too_frequent';
    END IF;
    v_anomaly_score := v_anomaly_score + 20;
    v_anomaly_flags := array_append(v_anomaly_flags, 'too_frequent');
  END IF;

  -- Only return anomaly if score is significant
  IF v_anomaly_score > 30 THEN
    RETURN jsonb_build_object(
      'is_anomaly', true,
      'anomaly_type', v_anomaly_type,
      'anomaly_score', v_anomaly_score,
      'anomaly_flags', v_anomaly_flags,
      'recent_scans', v_recent_scans,
      'token_age_seconds', p_token_age_seconds
    );
  END IF;

  RETURN jsonb_build_object('is_anomaly', false, 'anomaly_flags', ARRAY[]::TEXT[]);
END;
$$;

COMMENT ON FUNCTION public.detect_scan_anomaly IS 
'Detect suspicious scan patterns (rapid re-scans, old tokens, etc.) for anomaly detection. 
Returns anomaly flags array: rapid_rescan, old_iat, too_frequent. Only flags anomalies 
with score > 30.';

GRANT EXECUTE ON FUNCTION public.detect_scan_anomaly TO service_role;

