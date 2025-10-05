-- Enable pgcrypto for strong random generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 1: Drop old constraints/indexes if they exist
DROP INDEX IF EXISTS public.ux_tickets_order_tier_serial;
DROP TRIGGER IF EXISTS trg_ticket_counts ON public.tickets;
DROP TRIGGER IF EXISTS trg_assign_serial_no ON public.tickets;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS ck_tickets_serial_positive;
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS ck_tickets_qr_format;
ALTER TABLE public.ticket_tiers DROP CONSTRAINT IF EXISTS ck_ticket_tiers_qty;
DROP INDEX IF EXISTS ux_orders_checkout_session_id;

-- Step 2: Deterministic duplicate cleanup (tie-breaker: id)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY order_id, tier_id, serial_no
           ORDER BY created_at ASC, id ASC
         ) rn
  FROM public.tickets
  WHERE serial_no IS NOT NULL
)
DELETE FROM public.tickets
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 3: Backfill serial_no with offset to avoid collisions
WITH max_per_pair AS (
  SELECT order_id, tier_id, MAX(serial_no) AS max_serial
  FROM public.tickets
  GROUP BY 1, 2
),
todo AS (
  SELECT t.id, t.order_id, t.tier_id,
         ROW_NUMBER() OVER (PARTITION BY t.order_id, t.tier_id
                            ORDER BY t.created_at, t.id) AS rn
  FROM public.tickets t
  WHERE t.serial_no IS NULL
)
UPDATE public.tickets t
SET serial_no = COALESCE(m.max_serial, 0) + td.rn
FROM todo td
LEFT JOIN max_per_pair m
  ON m.order_id = td.order_id AND m.tier_id = td.tier_id
WHERE t.id = td.id;

-- Step 4: Create improved QR code generator with uniqueness guarantee
CREATE OR REPLACE FUNCTION public.gen_qr_code() RETURNS text AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out text;
  tries int := 0;
  i int; 
  idx int;
BEGIN
  LOOP
    out := '';
    FOR i IN 1..8 LOOP
      idx := (get_byte(gen_random_bytes(1), 0) % length(alphabet)) + 1;
      out := out || substr(alphabet, idx, 1);
    END LOOP;

    -- Ensure uniqueness
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.tickets WHERE qr_code = out);

    tries := tries + 1;
    IF tries > 8 THEN
      RAISE EXCEPTION 'Failed to generate unique qr_code after % tries', tries 
        USING ERRCODE = 'unique_violation';
    END IF;
  END LOOP;
  RETURN out;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Fix invalid QR codes using the new function
UPDATE public.tickets
SET qr_code = public.gen_qr_code()
WHERE qr_code IS NULL 
   OR char_length(qr_code) != 8 
   OR qr_code !~ '^[A-HJ-NP-Z2-9]{8}$';

-- Step 6: Set DEFAULT on qr_code column
ALTER TABLE public.tickets
  ALTER COLUMN qr_code SET DEFAULT public.gen_qr_code();

-- Step 7: Apply NOT NULL constraints
ALTER TABLE public.tickets
  ALTER COLUMN order_id SET NOT NULL,
  ALTER COLUMN tier_id  SET NOT NULL,
  ALTER COLUMN event_id SET NOT NULL,
  ALTER COLUMN qr_code  SET NOT NULL,
  ALTER COLUMN serial_no SET NOT NULL;

-- Step 8: Add validation constraints
ALTER TABLE public.tickets
  ADD CONSTRAINT ck_tickets_serial_positive CHECK (serial_no >= 1);

ALTER TABLE public.tickets
  ADD CONSTRAINT ck_tickets_qr_format
  CHECK (char_length(qr_code) = 8 AND qr_code ~ '^[A-HJ-NP-Z2-9]{8}$');

-- Step 9: Create unique indexes
CREATE UNIQUE INDEX ux_tickets_order_tier_serial
  ON public.tickets(order_id, tier_id, serial_no);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tickets_qr_code
  ON public.tickets(qr_code);

-- Step 10: Create performance indexes
CREATE INDEX IF NOT EXISTS ix_tickets_order ON public.tickets(order_id);
CREATE INDEX IF NOT EXISTS ix_tickets_tier  ON public.tickets(tier_id);

-- Step 11: Add foreign keys
ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS fk_tickets_orders,
  ADD CONSTRAINT fk_tickets_orders FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS fk_tickets_tiers,
  ADD CONSTRAINT fk_tickets_tiers FOREIGN KEY (tier_id) REFERENCES public.ticket_tiers(id);

-- Step 12: Ticket tiers quantity constraints
ALTER TABLE public.ticket_tiers
  ADD CONSTRAINT ck_ticket_tiers_qty
  CHECK (total_quantity IS NULL OR (total_quantity >= 0 AND sold_quantity >= 0 AND sold_quantity <= total_quantity));

-- Step 13: Add checkout_session_id to orders if it doesn't exist
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS tickets_issued_count INT NOT NULL DEFAULT 0;

-- Step 14: Create partial unique index for checkout_session_id
DROP INDEX IF EXISTS ux_orders_checkout_session_id;
CREATE UNIQUE INDEX ux_orders_checkout_session_id
  ON public.orders(checkout_session_id) WHERE checkout_session_id IS NOT NULL;

-- Step 15: Recompute sold_quantity (prevent drift)
UPDATE public.ticket_tiers t
SET sold_quantity = COALESCE(c.cnt, 0)
FROM (SELECT tier_id, COUNT(*) cnt FROM public.tickets GROUP BY tier_id) c
WHERE c.tier_id = t.id;

-- Step 16: Recompute tickets_issued_count (prevent drift)
UPDATE public.orders o
SET tickets_issued_count = COALESCE(c.cnt, 0)
FROM (SELECT order_id, COUNT(*) cnt FROM public.tickets GROUP BY order_id) c
WHERE c.order_id = o.id;

-- Step 17: Create improved trigger function that handles UPDATE
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

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.tier_id IS DISTINCT FROM OLD.tier_id THEN
      UPDATE public.ticket_tiers SET sold_quantity = GREATEST(sold_quantity - 1, 0) WHERE id = OLD.tier_id;
      UPDATE public.ticket_tiers SET sold_quantity = sold_quantity + 1 WHERE id = NEW.tier_id;
    END IF;

    IF NEW.order_id IS DISTINCT FROM OLD.order_id THEN
      UPDATE public.orders SET tickets_issued_count = GREATEST(tickets_issued_count - 1, 0) WHERE id = OLD.order_id;
      UPDATE public.orders SET tickets_issued_count = tickets_issued_count + 1 WHERE id = NEW.order_id;
    END IF;

    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 18: Create trigger for auto-maintaining counts
DROP TRIGGER IF EXISTS trg_ticket_counts ON public.tickets;
CREATE TRIGGER trg_ticket_counts
AFTER INSERT OR DELETE OR UPDATE OF order_id, tier_id ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.tg_ticket_counts();

-- Step 19: Create BEFORE INSERT trigger to auto-assign serial_no
CREATE OR REPLACE FUNCTION public.tg_assign_serial_no() RETURNS trigger AS $$
BEGIN
  IF NEW.serial_no IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.order_id::text || ':' || NEW.tier_id::text));
    SELECT COALESCE(MAX(serial_no), 0) + 1 INTO NEW.serial_no
    FROM public.tickets
    WHERE order_id = NEW.order_id AND tier_id = NEW.tier_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_serial_no ON public.tickets;
CREATE TRIGGER trg_assign_serial_no
BEFORE INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.tg_assign_serial_no();