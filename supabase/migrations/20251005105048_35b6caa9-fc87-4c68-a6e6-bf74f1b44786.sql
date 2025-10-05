-- Step 1: Drop the old unique index if it exists
DROP INDEX IF EXISTS public.ux_tickets_order_tier_serial;

-- Step 2: Backfill serial_no with proper sequential numbering
WITH ranked AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY order_id, tier_id ORDER BY created_at, id) as rn
  FROM public.tickets
)
UPDATE public.tickets t
SET serial_no = r.rn
FROM ranked r
WHERE t.id = r.id;

-- Step 3: Fix QR codes that don't match the strict format
CREATE OR REPLACE FUNCTION generate_qr_code() RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

UPDATE public.tickets
SET qr_code = generate_qr_code()
WHERE char_length(qr_code) != 8 OR qr_code !~ '^[A-HJ-NP-Z2-9]{8}$';

DROP FUNCTION generate_qr_code();

-- Step 4: Apply NOT NULL constraints to tickets
ALTER TABLE public.tickets
  ALTER COLUMN order_id SET NOT NULL,
  ALTER COLUMN tier_id  SET NOT NULL,
  ALTER COLUMN event_id SET NOT NULL,
  ALTER COLUMN qr_code  SET NOT NULL,
  ALTER COLUMN serial_no SET NOT NULL;

ALTER TABLE public.tickets
  ADD CONSTRAINT ck_tickets_serial_positive CHECK (serial_no >= 1);

ALTER TABLE public.tickets
  ADD CONSTRAINT ck_tickets_qr_format
  CHECK (char_length(qr_code) = 8 AND qr_code ~ '^[A-HJ-NP-Z2-9]{8}$');

-- Step 5: Create unique indexes for idempotency
CREATE UNIQUE INDEX ux_tickets_order_tier_serial
  ON public.tickets(order_id, tier_id, serial_no);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tickets_qr_code
  ON public.tickets(qr_code);

CREATE INDEX IF NOT EXISTS ix_tickets_order ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS ix_tickets_tier  ON public.tickets(tier_id);

-- Step 6: Add referential integrity
ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS fk_tickets_orders,
  ADD CONSTRAINT fk_tickets_orders FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS fk_tickets_tiers,
  ADD CONSTRAINT fk_tickets_tiers FOREIGN KEY (tier_id) REFERENCES public.ticket_tiers(id);

-- Step 7: Tighten TICKET_TIERS schema
ALTER TABLE public.ticket_tiers
  ADD CONSTRAINT ck_ticket_tiers_qty
  CHECK (total_quantity IS NULL OR (total_quantity >= 0 AND sold_quantity >= 0 AND sold_quantity <= total_quantity));

-- Step 8: Add checkout_session_id to ORDERS if it doesn't exist
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_session_id TEXT;

-- Create partial unique index (only for non-null values)
DROP INDEX IF EXISTS ux_orders_checkout_session_id;
CREATE UNIQUE INDEX ux_orders_checkout_session_id
  ON public.orders(checkout_session_id) WHERE checkout_session_id IS NOT NULL;

-- Step 9: Auto-maintain counts with triggers
CREATE OR REPLACE FUNCTION public.tg_ticket_counts() RETURNS trigger 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.ticket_tiers SET sold_quantity = sold_quantity + 1 WHERE id = NEW.tier_id;
    UPDATE public.orders SET tickets_issued_count = tickets_issued_count + 1 WHERE id = NEW.order_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.ticket_tiers SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = OLD.tier_id;
    UPDATE public.orders SET tickets_issued_count = GREATEST(tickets_issued_count - 1, 0) WHERE id = OLD.order_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_counts ON public.tickets;
CREATE TRIGGER trg_ticket_counts
AFTER INSERT OR DELETE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.tg_ticket_counts();