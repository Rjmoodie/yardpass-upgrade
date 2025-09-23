-- 1) Sponsor accounts (like organizations, but simpler)
CREATE TABLE public.sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  website_url text,
  contact_email text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Members of a sponsor (so a brand team can collaborate)
CREATE TYPE sponsor_role AS ENUM ('owner','admin','editor','viewer');

CREATE TABLE public.sponsor_members (
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role sponsor_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sponsor_id, user_id)
);

-- 3) Sponsorship packages organizers create for an event (supply)
CREATE TABLE public.sponsorship_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  tier text NOT NULL,
  price_cents int NOT NULL CHECK (price_cents >= 0),
  inventory int NOT NULL DEFAULT 1 CHECK (inventory >= 0),
  benefits jsonb NOT NULL DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4) Sponsorship orders (demand) — sponsor buys package (escrow compatible)
CREATE TYPE sponsorship_status AS ENUM ('pending','accepted','live','completed','refunded','cancelled');

CREATE TABLE public.sponsorship_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.sponsorship_packages(id) ON DELETE RESTRICT,
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  amount_cents int NOT NULL,
  status sponsorship_status NOT NULL DEFAULT 'pending',
  escrow_tx_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5) Event ↔ Sponsor relationship (actual sponsorship on the event page)
CREATE TABLE public.event_sponsorships (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sponsor_id uuid NOT NULL REFERENCES public.sponsors(id) ON DELETE CASCADE,
  tier text NOT NULL,
  amount_cents int NOT NULL DEFAULT 0,
  benefits jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, sponsor_id, tier)
);

-- Helpful indexes
CREATE INDEX ON public.sponsorship_packages (event_id);
CREATE INDEX ON public.sponsorship_orders (sponsor_id, status);
CREATE INDEX ON public.sponsorship_orders (event_id, status);
CREATE INDEX ON public.event_sponsorships (event_id);
CREATE INDEX ON public.sponsor_members (user_id);

-- View to power the marketplace search
CREATE VIEW public.marketplace_sponsorships AS
SELECT
  p.id as package_id,
  e.id as event_id,
  e.title as event_title,
  e.city,
  e.category,
  e.start_at,
  p.tier,
  p.price_cents,
  p.inventory,
  p.benefits
FROM public.sponsorship_packages p
JOIN public.events e ON e.id = p.event_id
WHERE p.visibility = 'public';

-- Enable RLS
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsor_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_sponsorships ENABLE ROW LEVEL SECURITY;

-- Sponsor visibility (owners & members)
CREATE POLICY "sponsor_rw_members"
ON public.sponsors
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.sponsor_members sm
  WHERE sm.sponsor_id = sponsors.id AND sm.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sponsor_members sm
  WHERE sm.sponsor_id = sponsors.id AND sm.user_id = auth.uid()
));

-- Sponsor_members: user can see rows they belong to
CREATE POLICY "sponsor_members_rw_self"
ON public.sponsor_members
FOR ALL
TO authenticated
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.sponsor_members sm
  WHERE sm.sponsor_id = sponsor_members.sponsor_id
    AND sm.user_id = auth.uid()
    AND sm.role IN ('owner','admin')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sponsor_members sm
  WHERE sm.sponsor_id = sponsor_members.sponsor_id
    AND sm.user_id = auth.uid()
    AND sm.role IN ('owner','admin')
));

-- Sponsorship_packages: writable by event managers, readable for marketplace
CREATE POLICY "packages_public_read"
ON public.sponsorship_packages
FOR SELECT
TO anon, authenticated
USING (visibility = 'public');

CREATE POLICY "packages_event_manager_write"
ON public.sponsorship_packages
FOR ALL
TO authenticated
USING (is_event_manager(event_id))
WITH CHECK (is_event_manager(event_id));

-- Sponsorship_orders: sponsors can create orders for themselves; organizers can read orders for their event
CREATE POLICY "orders_sponsor_crud"
ON public.sponsorship_orders
FOR ALL
TO authenticated
USING (
  sponsor_id IN (SELECT sponsor_id FROM public.sponsor_members WHERE user_id = auth.uid())
  OR is_event_manager(event_id)
)
WITH CHECK (
  sponsor_id IN (SELECT sponsor_id FROM public.sponsor_members WHERE user_id = auth.uid())
);

-- Event_sponsorships readable by: event owners & sponsor members
CREATE POLICY "event_sponsorships_read"
ON public.event_sponsorships
FOR SELECT
TO authenticated
USING (
  is_event_manager(event_id)
  OR sponsor_id IN (SELECT sponsor_id FROM public.sponsor_members WHERE user_id = auth.uid())
);

-- Create sponsorship revenue materialized view
CREATE MATERIALIZED VIEW mv_sponsorship_revenue AS
SELECT
  e.id as event_id,
  SUM(CASE WHEN o.status IN ('accepted','live','completed') THEN o.amount_cents ELSE 0 END) as booked_cents,
  SUM(CASE WHEN o.status = 'completed' THEN o.amount_cents ELSE 0 END) as completed_cents
FROM public.events e
LEFT JOIN public.sponsorship_orders o ON o.event_id = e.id
GROUP BY e.id;

CREATE INDEX ON mv_sponsorship_revenue (event_id);