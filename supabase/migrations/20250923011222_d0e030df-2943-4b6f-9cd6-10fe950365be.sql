-- Update sponsorship_packages table to match requirements
ALTER TABLE public.sponsorship_packages 
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd',
ADD COLUMN IF NOT EXISTS inventory integer NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS sold integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS created_by uuid;

-- Rename tier to title if needed (tier column exists, title doesn't)
UPDATE public.sponsorship_packages SET title = tier WHERE title IS NULL;

-- Update sponsorship_orders table to match requirements  
ALTER TABLE public.sponsorship_orders
ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd',
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS stripe_charge_id text,
ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
ADD COLUMN IF NOT EXISTS transfer_group text,
ADD COLUMN IF NOT EXISTS application_fee_cents integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Create organizer_connect view (using existing payout_accounts table)
CREATE OR REPLACE VIEW public.organizer_connect AS
SELECT 
  context_type::text as owner_context_type,
  context_id as owner_context_id,
  stripe_connect_id as stripe_connect_account_id
FROM public.payout_accounts;

-- Create event_connect view for easy lookups
CREATE OR REPLACE VIEW public.event_connect AS
SELECT 
  e.id as event_id, 
  oc.stripe_connect_account_id
FROM public.events e
JOIN public.organizer_connect oc
  ON oc.owner_context_type = e.owner_context_type::text
  AND oc.owner_context_id = e.owner_context_id;

-- Add RLS policies for sponsorship_packages
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sponsorship_packages' 
    AND policyname = 'organizers_manage_packages'
  ) THEN
    CREATE POLICY "organizers_manage_packages" ON public.sponsorship_packages
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.events e 
          WHERE e.id = sponsorship_packages.event_id 
          AND is_event_manager(e.id)
        )
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sponsorship_packages' 
    AND policyname = 'sponsors_read_packages'
  ) THEN
    CREATE POLICY "sponsors_read_packages" ON public.sponsorship_packages
      FOR SELECT USING (visibility = 'public' AND is_active = true);
  END IF;
END $$;

-- Update existing RLS policies for sponsorship_orders
DROP POLICY IF EXISTS "orders_sponsor_crud" ON public.sponsorship_orders;
CREATE POLICY "orders_sponsor_crud" ON public.sponsorship_orders
  FOR ALL USING (
    (sponsor_id IN (
      SELECT sponsor_members.sponsor_id
      FROM sponsor_members
      WHERE sponsor_members.user_id = auth.uid()
    )) OR is_event_manager(event_id)
  )
  WITH CHECK (
    sponsor_id IN (
      SELECT sponsor_members.sponsor_id
      FROM sponsor_members
      WHERE sponsor_members.user_id = auth.uid()
    )
  );

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_sponsorship_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_sponsorship_orders_updated_at ON public.sponsorship_orders;
CREATE TRIGGER update_sponsorship_orders_updated_at
  BEFORE UPDATE ON public.sponsorship_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_sponsorship_orders_updated_at();