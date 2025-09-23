-- Phase 1: Critical fixes for hot-path oversell protection (Fixed - with inventory_operations table)
-- Implement guarded UPDATE, proper constraints, and holds table

-- Step 1: Create inventory_operations table first (was missing)
CREATE TABLE IF NOT EXISTS public.inventory_operations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier_id uuid NOT NULL REFERENCES public.ticket_tiers(id),
  operation_type text NOT NULL CHECK (operation_type IN ('reserve', 'release', 'purchase', 'refund')),
  quantity integer NOT NULL,
  session_id text,
  order_id uuid REFERENCES public.orders(id),
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS on inventory_operations
ALTER TABLE public.inventory_operations ENABLE ROW LEVEL SECURITY;

-- Only system/service can write, admins can read
CREATE POLICY inventory_operations_system_write ON public.inventory_operations
  FOR ALL USING (false) WITH CHECK (false);

CREATE POLICY inventory_operations_admin_read ON public.inventory_operations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ticket_tiers tt
      JOIN public.events e ON e.id = tt.event_id
      WHERE tt.id = inventory_operations.tier_id
      AND is_event_manager(e.id)
    )
  );

-- Step 2: Add inventory guard constraint to prevent overselling
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'ticket_tiers_inventory_guard'
    AND table_name = 'ticket_tiers'
  ) THEN
    ALTER TABLE public.ticket_tiers
    ADD CONSTRAINT ticket_tiers_inventory_guard
    CHECK (
      sold_quantity >= 0
      AND sold_quantity <= COALESCE(total_quantity, quantity)
    );
  END IF;
END $$;

-- Step 3: Add reserved/issued quantity columns for proper phase separation
ALTER TABLE public.ticket_tiers
  ADD COLUMN IF NOT EXISTS reserved_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS issued_quantity integer NOT NULL DEFAULT 0;

-- Step 4: Create ticket holds table for abandoned cart protection
CREATE TABLE IF NOT EXISTS public.ticket_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id uuid NOT NULL REFERENCES public.ticket_tiers(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  session_id text,
  user_id uuid,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'expired', 'released')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  order_id uuid REFERENCES public.orders(id),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS on ticket_holds
ALTER TABLE public.ticket_holds ENABLE ROW LEVEL SECURITY;

-- Users can see their own holds, admins can see event holds
CREATE POLICY ticket_holds_user_read ON public.ticket_holds
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.ticket_tiers tt
      JOIN public.events e ON e.id = tt.event_id
      WHERE tt.id = ticket_holds.tier_id
      AND is_event_manager(e.id)
    )
  );

-- Only system can write holds
CREATE POLICY ticket_holds_system_write ON public.ticket_holds
  FOR ALL USING (false) WITH CHECK (false);

-- Step 5: Replace reserve_tickets_atomic with guarded UPDATE approach
CREATE OR REPLACE FUNCTION public.reserve_tickets_atomic(
  p_tier_id uuid,
  p_quantity integer,
  p_session_id text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_expires_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier_record RECORD;
  v_hold_id uuid;
  v_expires_at timestamptz;
BEGIN
  -- Input validation
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INVALID_QUANTITY',
      'error', 'Quantity must be greater than 0'
    );
  END IF;
  
  -- Use advisory lock for strict serialization per tier
  PERFORM pg_advisory_xact_lock(hashtext(p_tier_id::text));
  
  -- Calculate expiration time
  v_expires_at := now() + interval '1 minute' * p_expires_minutes;
  
  -- Guarded increment: only succeeds if enough inventory remains
  -- This checks and increments in one atomic operation
  UPDATE ticket_tiers
  SET reserved_quantity = reserved_quantity + p_quantity
  WHERE id = p_tier_id
    AND status = 'active'
    AND (reserved_quantity + issued_quantity + p_quantity) <= COALESCE(total_quantity, quantity)
    AND (max_per_order IS NULL OR p_quantity <= max_per_order)
  RETURNING 
    id, name, price_cents, reserved_quantity, issued_quantity, 
    COALESCE(total_quantity, quantity) AS total_qty,
    max_per_order
  INTO v_tier_record;
  
  -- Check if update succeeded
  IF NOT FOUND THEN
    -- Get current state for better error message
    SELECT 
      name, 
      reserved_quantity + issued_quantity AS current_sold,
      COALESCE(total_quantity, quantity) AS total_qty,
      max_per_order,
      status
    INTO v_tier_record
    FROM ticket_tiers 
    WHERE id = p_tier_id;
    
    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'TIER_NOT_FOUND',
        'error', 'Ticket tier not found'
      );
    END IF;
    
    IF v_tier_record.status != 'active' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'TIER_INACTIVE',
        'error', format('Ticket tier %s is not available for purchase', v_tier_record.name)
      );
    END IF;
    
    IF v_tier_record.max_per_order IS NOT NULL AND p_quantity > v_tier_record.max_per_order THEN
      RETURN jsonb_build_object(
        'success', false,
        'error_code', 'EXCEEDS_MAX_PER_ORDER',
        'error', format('Cannot purchase more than %s tickets per order for %s', v_tier_record.max_per_order, v_tier_record.name),
        'max_per_order', v_tier_record.max_per_order,
        'requested_quantity', p_quantity
      );
    END IF;
    
    -- Must be insufficient inventory
    RETURN jsonb_build_object(
      'success', false,
      'error_code', 'INSUFFICIENT_INVENTORY',
      'error', format('Only %s tickets available for %s', 
        v_tier_record.total_qty - v_tier_record.current_sold, 
        v_tier_record.name),
      'available_quantity', v_tier_record.total_qty - v_tier_record.current_sold,
      'requested_quantity', p_quantity
    );
  END IF;
  
  -- Create hold record
  INSERT INTO ticket_holds (
    tier_id, quantity, session_id, user_id, expires_at, status
  ) VALUES (
    p_tier_id, p_quantity, p_session_id, p_user_id, v_expires_at, 'active'
  ) RETURNING id INTO v_hold_id;
  
  -- Log the operation
  INSERT INTO inventory_operations (
    tier_id, operation_type, quantity, session_id, user_id, metadata
  ) VALUES (
    p_tier_id, 'reserve', p_quantity, p_session_id, p_user_id,
    jsonb_build_object(
      'hold_id', v_hold_id,
      'expires_at', v_expires_at
    )
  );
  
  -- Return success with reservation details
  RETURN jsonb_build_object(
    'success', true,
    'hold_id', v_hold_id,
    'tier_id', v_tier_record.id,
    'reserved_quantity', p_quantity,
    'session_id', p_session_id,
    'user_id', p_user_id,
    'expires_at', v_expires_at,
    'tier_name', v_tier_record.name,
    'price_cents', v_tier_record.price_cents,
    'new_reserved_quantity', v_tier_record.reserved_quantity,
    'remaining_quantity', v_tier_record.total_qty - v_tier_record.reserved_quantity - v_tier_record.issued_quantity
  );
END;
$$;

-- Step 6: Update batch reservation function
CREATE OR REPLACE FUNCTION public.reserve_tickets_batch(
  p_reservations jsonb,
  p_session_id text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_expires_minutes integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation jsonb;
  v_result jsonb;
  v_results jsonb[] := '{}';
  v_all_success boolean := true;
  v_error_results jsonb[] := '{}';
  v_hold_ids uuid[] := '{}';
BEGIN
  -- Process each reservation in sequence
  FOR v_reservation IN SELECT jsonb_array_elements(p_reservations)
  LOOP
    SELECT reserve_tickets_atomic(
      (v_reservation->>'tier_id')::uuid,
      (v_reservation->>'quantity')::integer,
      p_session_id,
      p_user_id,
      p_expires_minutes
    ) INTO v_result;
    
    v_results := v_results || v_result;
    
    -- Collect hold IDs for successful reservations
    IF (v_result->>'success')::boolean THEN
      v_hold_ids := v_hold_ids || (v_result->>'hold_id')::uuid;
    ELSE
      v_all_success := false;
      v_error_results := v_error_results || v_result;
    END IF;
  END LOOP;
  
  -- If any reservation failed, rollback by raising exception
  -- This will automatically rollback all the reservation updates and hold insertions
  IF NOT v_all_success THEN
    RAISE EXCEPTION 'Batch reservation failed: %', 
      (SELECT string_agg(r->>'error', '; ') 
       FROM unnest(v_error_results) AS r);
  END IF;
  
  -- Return all successful reservations
  RETURN jsonb_build_object(
    'success', true,
    'reservations', array_to_json(v_results)::jsonb,
    'hold_ids', v_hold_ids,
    'session_id', p_session_id,
    'user_id', p_user_id,
    'total_items', array_length(v_results, 1),
    'expires_at', (v_results[1]->>'expires_at')::timestamptz
  );
END;
$$;

-- Step 7: Create function to consume holds (convert to issued tickets)
CREATE OR REPLACE FUNCTION public.consume_ticket_holds(
  p_hold_ids uuid[],
  p_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold_record RECORD;
  v_consumed_count integer := 0;
  v_total_quantity integer := 0;
BEGIN
  -- Process each hold
  FOR v_hold_record IN 
    SELECT h.id, h.tier_id, h.quantity, h.session_id, h.user_id
    FROM ticket_holds h
    WHERE h.id = ANY(p_hold_ids)
      AND h.status = 'active'
      AND h.expires_at > now()
    FOR UPDATE
  LOOP
    -- Use advisory lock for the tier
    PERFORM pg_advisory_xact_lock(hashtext(v_hold_record.tier_id::text));
    
    -- Convert reserved to issued
    UPDATE ticket_tiers
    SET 
      reserved_quantity = reserved_quantity - v_hold_record.quantity,
      issued_quantity = issued_quantity + v_hold_record.quantity
    WHERE id = v_hold_record.tier_id;
    
    -- Mark hold as consumed
    UPDATE ticket_holds
    SET status = 'consumed', order_id = p_order_id
    WHERE id = v_hold_record.id;
    
    -- Log the operation
    INSERT INTO inventory_operations (
      tier_id, operation_type, quantity, session_id, user_id, order_id, metadata
    ) VALUES (
      v_hold_record.tier_id, 'purchase', v_hold_record.quantity,
      v_hold_record.session_id, v_hold_record.user_id, p_order_id,
      jsonb_build_object('hold_id', v_hold_record.id)
    );
    
    v_consumed_count := v_consumed_count + 1;
    v_total_quantity := v_total_quantity + v_hold_record.quantity;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'consumed_holds', v_consumed_count,
    'total_quantity', v_total_quantity,
    'order_id', p_order_id
  );
END;
$$;

-- Step 8: Create function to release expired or failed holds
CREATE OR REPLACE FUNCTION public.release_ticket_holds(
  p_hold_ids uuid[] DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_reason text DEFAULT 'expired'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hold_record RECORD;
  v_released_count integer := 0;
  v_total_quantity integer := 0;
BEGIN
  -- Build based on parameters
  IF p_hold_ids IS NOT NULL THEN
    -- Release specific holds
    FOR v_hold_record IN 
      SELECT h.id, h.tier_id, h.quantity, h.session_id, h.user_id
      FROM ticket_holds h
      WHERE h.id = ANY(p_hold_ids)
        AND h.status = 'active'
      FOR UPDATE
    LOOP
      -- Use advisory lock for the tier
      PERFORM pg_advisory_xact_lock(hashtext(v_hold_record.tier_id::text));
      
      -- Release reserved quantity
      UPDATE ticket_tiers
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_hold_record.quantity)
      WHERE id = v_hold_record.tier_id;
      
      -- Mark hold as released
      UPDATE ticket_holds
      SET status = 'released'
      WHERE id = v_hold_record.id;
      
      -- Log the operation
      INSERT INTO inventory_operations (
        tier_id, operation_type, quantity, session_id, user_id, metadata
      ) VALUES (
        v_hold_record.tier_id, 'release', v_hold_record.quantity,
        v_hold_record.session_id, v_hold_record.user_id,
        jsonb_build_object('hold_id', v_hold_record.id, 'reason', p_reason)
      );
      
      v_released_count := v_released_count + 1;
      v_total_quantity := v_total_quantity + v_hold_record.quantity;
    END LOOP;
  ELSIF p_session_id IS NOT NULL THEN
    -- Release all active holds for a session
    FOR v_hold_record IN 
      SELECT h.id, h.tier_id, h.quantity, h.session_id, h.user_id
      FROM ticket_holds h
      WHERE h.session_id = p_session_id
        AND h.status = 'active'
      FOR UPDATE
    LOOP
      -- Use advisory lock for the tier
      PERFORM pg_advisory_xact_lock(hashtext(v_hold_record.tier_id::text));
      
      -- Release reserved quantity
      UPDATE ticket_tiers
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_hold_record.quantity)
      WHERE id = v_hold_record.tier_id;
      
      -- Mark hold as released
      UPDATE ticket_holds
      SET status = 'released'
      WHERE id = v_hold_record.id;
      
      -- Log the operation
      INSERT INTO inventory_operations (
        tier_id, operation_type, quantity, session_id, user_id, metadata
      ) VALUES (
        v_hold_record.tier_id, 'release', v_hold_record.quantity,
        v_hold_record.session_id, v_hold_record.user_id,
        jsonb_build_object('hold_id', v_hold_record.id, 'reason', p_reason)
      );
      
      v_released_count := v_released_count + 1;
      v_total_quantity := v_total_quantity + v_hold_record.quantity;
    END LOOP;
  ELSE
    -- Release all expired holds
    FOR v_hold_record IN 
      SELECT h.id, h.tier_id, h.quantity, h.session_id, h.user_id
      FROM ticket_holds h
      WHERE h.status = 'active'
        AND h.expires_at < now()
      FOR UPDATE
    LOOP
      -- Use advisory lock for the tier
      PERFORM pg_advisory_xact_lock(hashtext(v_hold_record.tier_id::text));
      
      -- Release reserved quantity
      UPDATE ticket_tiers
      SET reserved_quantity = GREATEST(0, reserved_quantity - v_hold_record.quantity)
      WHERE id = v_hold_record.tier_id;
      
      -- Mark hold as expired
      UPDATE ticket_holds
      SET status = 'expired'
      WHERE id = v_hold_record.id;
      
      -- Log the operation
      INSERT INTO inventory_operations (
        tier_id, operation_type, quantity, session_id, user_id, metadata
      ) VALUES (
        v_hold_record.tier_id, 'release', v_hold_record.quantity,
        v_hold_record.session_id, v_hold_record.user_id,
        jsonb_build_object('hold_id', v_hold_record.id, 'reason', 'expired')
      );
      
      v_released_count := v_released_count + 1;
      v_total_quantity := v_total_quantity + v_hold_record.quantity;
    END LOOP;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'released_holds', v_released_count,
    'total_quantity', v_total_quantity,
    'reason', p_reason
  );
END;
$$;

-- Step 9: Remove the old trigger that causes drift
DROP TRIGGER IF EXISTS trigger_sync_ticket_tier_sold_quantity ON public.tickets;
DROP FUNCTION IF EXISTS public.sync_ticket_tier_sold_quantity();

-- Step 10: Update existing data to migrate from sold_quantity to reserved/issued split
-- Move current sold_quantity to issued_quantity and zero out reserved_quantity
UPDATE public.ticket_tiers
SET 
  issued_quantity = COALESCE((
    SELECT COUNT(*)
    FROM public.tickets t
    WHERE t.tier_id = ticket_tiers.id
    AND t.status IN ('issued', 'transferred', 'redeemed')
  ), 0),
  reserved_quantity = 0
WHERE issued_quantity = 0; -- Only update if not already migrated

-- Step 11: Add indexes for performance (not CONCURRENTLY since we're in a migration)
CREATE INDEX IF NOT EXISTS idx_ticket_tiers_inventory 
ON public.ticket_tiers (id, reserved_quantity, issued_quantity);

CREATE INDEX IF NOT EXISTS idx_ticket_holds_tier_status 
ON public.ticket_holds (tier_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_ticket_holds_session_status 
ON public.ticket_holds (session_id, status);

CREATE INDEX IF NOT EXISTS idx_inventory_operations_tier_type 
ON public.inventory_operations (tier_id, operation_type, created_at DESC);

-- Step 12: Update helper function to use new columns
CREATE OR REPLACE FUNCTION public.get_tier_inventory_status(p_tier_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'tier_id', id,
    'tier_name', name,
    'total_quantity', COALESCE(total_quantity, quantity),
    'reserved_quantity', reserved_quantity,
    'issued_quantity', issued_quantity,
    'available_quantity', COALESCE(total_quantity, quantity) - reserved_quantity - issued_quantity,
    'status', status,
    'price_cents', price_cents,
    'max_per_order', max_per_order
  )
  FROM public.ticket_tiers
  WHERE id = p_tier_id;
$$;

-- Step 13: Create cleanup function for expired holds (to be called by cron)
CREATE OR REPLACE FUNCTION public.cleanup_expired_holds()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Release all expired holds
  SELECT release_ticket_holds(NULL, NULL, 'expired') INTO v_result;
  
  RETURN v_result;
END;
$$;