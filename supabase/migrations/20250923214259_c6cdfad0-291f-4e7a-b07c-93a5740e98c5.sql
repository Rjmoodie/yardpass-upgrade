-- Fix search_path security issue for the get_inventory_health function
DROP FUNCTION IF EXISTS get_inventory_health();

CREATE OR REPLACE FUNCTION get_inventory_health()
RETURNS TABLE(
  tier_id UUID,
  tier_name TEXT,
  event_id UUID,
  total_quantity INTEGER,
  reserved_quantity INTEGER,
  issued_quantity INTEGER,
  available INTEGER,
  health_status TEXT
) 
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    tt.id as tier_id,
    tt.name as tier_name,
    tt.event_id,
    tt.total_quantity,
    tt.reserved_quantity,
    tt.issued_quantity,
    (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) as available,
    CASE 
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) < 0 THEN 'OVERSOLD'
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) = 0 THEN 'SOLD_OUT'
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) <= 5 THEN 'LOW_INVENTORY'
      ELSE 'HEALTHY'
    END as health_status
  FROM ticket_tiers tt
  WHERE tt.status = 'active'
  ORDER BY 
    CASE 
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) < 0 THEN 1
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) = 0 THEN 2
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) <= 5 THEN 3
      ELSE 4
    END,
    tt.event_id, tt.name;
$$;