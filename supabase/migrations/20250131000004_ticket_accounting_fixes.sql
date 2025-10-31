-- ============================================================================
-- TICKET ACCOUNTING SYSTEM - Complete Fix
-- ============================================================================
-- This migration ensures proper ticket accounting from start to finish:
-- 1. Auto-sync issued_quantity when tickets are created/deleted
-- 2. Auto-cleanup expired holds
-- 3. Recalculate reserved_quantity on hold changes
-- 4. Add helper functions for availability checks
-- ============================================================================

-- ============================================================================
-- 1. TRIGGER: Auto-update issued_quantity when tickets are created/deleted
-- ============================================================================
-- Note: If 'tickets' is a view, we need to trigger on the base table
-- We'll create the function but apply the trigger conditionally

CREATE OR REPLACE FUNCTION public.sync_issued_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment issued_quantity when ticket is created
    UPDATE ticket_tiers
    SET issued_quantity = issued_quantity + 1
    WHERE id = NEW.tier_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement issued_quantity when ticket is deleted
    UPDATE ticket_tiers
    SET issued_quantity = GREATEST(0, issued_quantity - 1)
    WHERE id = OLD.tier_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_sync_issued_quantity ON tickets;
DROP TRIGGER IF EXISTS trg_sync_issued_quantity ON ticketing.tickets;

-- Create trigger on the BASE TABLE in ticketing schema
CREATE TRIGGER trg_sync_issued_quantity
  AFTER INSERT OR DELETE ON ticketing.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_issued_quantity();

-- ============================================================================
-- 2. Drop old cleanup function if it exists (might have different signature)
-- ============================================================================

DROP FUNCTION IF EXISTS public.cleanup_expired_holds() CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_ticket_holds() CASCADE;

-- ============================================================================
-- 3. TRIGGER: Auto-update reserved_quantity on hold insert/delete
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_reserved_quantity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment reserved_quantity when hold is created
    UPDATE ticket_tiers
    SET reserved_quantity = reserved_quantity + NEW.quantity
    WHERE id = NEW.tier_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement reserved_quantity when hold is deleted
    UPDATE ticket_tiers
    SET reserved_quantity = GREATEST(0, reserved_quantity - OLD.quantity)
    WHERE id = OLD.tier_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle quantity changes
    IF NEW.quantity != OLD.quantity THEN
      UPDATE ticket_tiers
      SET reserved_quantity = reserved_quantity + (NEW.quantity - OLD.quantity)
      WHERE id = NEW.tier_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_sync_reserved_quantity ON ticket_holds;
DROP TRIGGER IF EXISTS trg_sync_reserved_quantity ON ticketing.ticket_holds;

-- Create trigger on the BASE TABLE in ticketing schema
CREATE TRIGGER trg_sync_reserved_quantity
  AFTER INSERT OR DELETE OR UPDATE ON ticketing.ticket_holds
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_reserved_quantity();

-- ============================================================================
-- 4. SCHEDULED FUNCTION: Bulk cleanup of expired holds
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_ticket_holds()
RETURNS TABLE(
  cleaned_holds INTEGER,
  tickets_released INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cleaned_holds INTEGER := 0;
  v_tickets_released INTEGER := 0;
BEGIN
  -- Delete expired holds and return counts
  WITH deleted AS (
    DELETE FROM ticketing.ticket_holds
    WHERE expires_at < NOW()
      AND status = 'active'
    RETURNING id, tier_id, quantity
  )
  SELECT COUNT(*), COALESCE(SUM(quantity), 0)
  INTO v_cleaned_holds, v_tickets_released
  FROM deleted;
  
  -- Recalculate reserved_quantity for affected tiers
  -- (This is redundant if triggers are working, but ensures consistency)
  UPDATE ticket_tiers tt
  SET reserved_quantity = COALESCE(
    (
      SELECT SUM(th.quantity)
      FROM ticketing.ticket_holds th
      WHERE th.tier_id = tt.id
        AND th.expires_at > NOW()
        AND th.status = 'active'
    ),
    0
  );
  
  RETURN QUERY SELECT v_cleaned_holds, v_tickets_released;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_expired_ticket_holds TO authenticated, anon;

-- ============================================================================
-- 5. ONE-TIME FIX: Sync issued_quantity with actual ticket counts
-- ============================================================================

-- Recalculate issued_quantity for all tiers based on actual tickets
UPDATE ticket_tiers tt
SET issued_quantity = COALESCE(
  (
    SELECT COUNT(*)
    FROM ticketing.tickets t
    WHERE t.tier_id = tt.id
  ),
  0
);

-- Recalculate reserved_quantity for all tiers based on active holds
UPDATE ticket_tiers tt
SET reserved_quantity = COALESCE(
  (
    SELECT SUM(th.quantity)
    FROM ticketing.ticket_holds th
    WHERE th.tier_id = tt.id
      AND th.expires_at > NOW()
      AND th.status = 'active'
  ),
  0
);

-- ============================================================================
-- 6. HELPER FUNCTION: Get ticket tier availability
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_ticket_tier_availability(p_tier_id UUID)
RETURNS TABLE(
  tier_id UUID,
  tier_name TEXT,
  total_capacity INTEGER,
  reserved_quantity INTEGER,
  issued_quantity INTEGER,
  available_quantity INTEGER,
  is_sold_out BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tt.id,
    tt.name,
    tt.quantity,
    tt.reserved_quantity,
    tt.issued_quantity,
    (tt.quantity - tt.reserved_quantity - tt.issued_quantity) as available,
    (tt.quantity - tt.reserved_quantity - tt.issued_quantity) <= 0 as sold_out
  FROM ticket_tiers tt
  WHERE tt.id = p_tier_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ticket_tier_availability TO authenticated, anon;

-- ============================================================================
-- 7. VIEW: Real-time ticket availability
-- ============================================================================

CREATE OR REPLACE VIEW public.ticket_availability AS
SELECT 
  tt.id as tier_id,
  tt.event_id,
  tt.name as tier_name,
  tt.price_cents,
  tt.quantity as total_capacity,
  tt.reserved_quantity,
  tt.issued_quantity,
  (tt.quantity - tt.reserved_quantity - tt.issued_quantity) as available_quantity,
  (tt.quantity - tt.reserved_quantity - tt.issued_quantity) <= 0 as is_sold_out,
  CASE 
    WHEN (tt.quantity - tt.reserved_quantity - tt.issued_quantity) = 0 THEN 'sold_out'
    WHEN (tt.quantity - tt.reserved_quantity - tt.issued_quantity) < 10 THEN 'low_stock'
    ELSE 'available'
  END as availability_status
FROM ticket_tiers tt
WHERE tt.status = 'active';

GRANT SELECT ON public.ticket_availability TO authenticated, anon;

-- ============================================================================
-- 8. VERIFICATION: Show current state
-- ============================================================================

SELECT 
  'Ticket Accounting Fix Applied' as message,
  COUNT(*) as total_tiers,
  SUM(quantity) as total_capacity,
  SUM(reserved_quantity) as total_reserved,
  SUM(issued_quantity) as total_issued,
  SUM(quantity - reserved_quantity - issued_quantity) as total_available
FROM ticket_tiers
WHERE status = 'active';

-- Show YardPass Launch specifically
SELECT 
  name as tier_name,
  quantity as capacity,
  reserved_quantity as on_hold,
  issued_quantity as sold,
  (quantity - reserved_quantity - issued_quantity) as available
FROM ticket_tiers
WHERE event_id = '529d3fcb-bc8d-4f5c-864c-ab82e4f75bf3';

