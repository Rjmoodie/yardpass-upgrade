-- Add serial_no for deterministic ticket sequence per order
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS serial_no INT;

-- One ticket per (order, tier, serial_no) === idempotent issuance
CREATE UNIQUE INDEX IF NOT EXISTS ux_tickets_order_tier_serial
  ON public.tickets(order_id, tier_id, serial_no);

-- Make QR codes unique
CREATE UNIQUE INDEX IF NOT EXISTS ux_tickets_qr_code
  ON public.tickets(qr_code);

-- Live inventory tracking (optional but recommended)
ALTER TABLE public.ticket_tiers
  ADD COLUMN IF NOT EXISTS total_quantity INT,
  ADD COLUMN IF NOT EXISTS sold_quantity INT DEFAULT 0;

-- Record issued ticket count for audit/debug
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tickets_issued_count INT DEFAULT 0;