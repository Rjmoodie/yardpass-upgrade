-- Enable cryptographic RNG for qr_code and guest_code generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Advisory lock: use 2-key variant for better distribution
CREATE OR REPLACE FUNCTION public.claim_order_ticketing(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT pg_try_advisory_xact_lock(
    ('x' || substr(replace($1::text,'-',''),1,8))::bit(32)::int,
    ('x' || substr(replace($1::text,'-',''),9,8))::bit(32)::int
  );
$$;

-- 2) Capacity: atomic reservation per row (BEFORE INSERT)
CREATE OR REPLACE FUNCTION public.trg_reserve_tier_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If no cap, skip
  IF (SELECT total_quantity IS NULL FROM public.ticket_tiers WHERE id = NEW.tier_id) THEN
    RETURN NEW;
  END IF;

  -- Reserve 1 atomically; fails if at capacity
  UPDATE public.ticket_tiers
     SET sold_quantity = sold_quantity + 1
   WHERE id = NEW.tier_id
     AND (total_quantity IS NULL OR sold_quantity + 1 <= total_quantity)
  RETURNING id
  INTO NEW.tier_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tier % at capacity', NEW.tier_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_capacity ON public.tickets;
DROP TRIGGER IF EXISTS trg_reserve_capacity ON public.tickets;
CREATE TRIGGER trg_reserve_capacity
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_reserve_tier_capacity();

-- Decrement on delete
CREATE OR REPLACE FUNCTION public.trg_release_tier_capacity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.ticket_tiers
     SET sold_quantity = GREATEST(sold_quantity - 1, 0)
   WHERE id = OLD.tier_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_capacity ON public.tickets;
CREATE TRIGGER trg_release_capacity
  AFTER DELETE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_release_tier_capacity();

-- Fix ticket counts trigger: only touch orders.tickets_issued_count (not tier.sold_quantity)
CREATE OR REPLACE FUNCTION public.tg_ticket_counts() 
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.orders
       SET tickets_issued_count = tickets_issued_count + 1
     WHERE id = NEW.order_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.orders
       SET tickets_issued_count = GREATEST(tickets_issued_count - 1, 0)
     WHERE id = OLD.order_id;
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_counts ON public.tickets;
CREATE TRIGGER trg_ticket_counts
  AFTER INSERT OR DELETE ON public.tickets
  FOR EACH ROW 
  EXECUTE FUNCTION public.tg_ticket_counts();

-- 3) Set qr_code default (gen_qr_code already created in previous migration)
ALTER TABLE public.tickets
  ALTER COLUMN qr_code SET DEFAULT gen_qr_code();

-- serial_no assignment trigger (safe under concurrency with advisory lock)
CREATE OR REPLACE FUNCTION public.trg_assign_serial_no()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_last int;
BEGIN
  IF NEW.serial_no IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Per (order_id,tier_id) advisory lock to serialize numbering
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(replace(NEW.order_id::text,'-',''),1,8))::bit(32)::int,
    ('x' || substr(replace(NEW.tier_id::text,'-',''),1,8))::bit(32)::int
  );

  SELECT serial_no
    INTO v_last
    FROM public.tickets
   WHERE order_id = NEW.order_id
     AND tier_id  = NEW.tier_id
   ORDER BY serial_no DESC
   LIMIT 1
   FOR UPDATE;

  NEW.serial_no := COALESCE(v_last, 0) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_serial_no ON public.tickets;
CREATE TRIGGER trg_assign_serial_no
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_assign_serial_no();

-- 4) Make invite email uniqueness case-insensitive
DROP INDEX IF EXISTS ux_event_invites_event_email;
CREATE UNIQUE INDEX ux_event_invites_event_email
  ON public.event_invites(event_id, lower(email))
  WHERE email IS NOT NULL;

-- 5) Performance index for tickets by event_id
CREATE INDEX IF NOT EXISTS ix_tickets_event ON public.tickets(event_id);