-- =====================================================
-- PHASE 2: STRIPE CONNECT PAYOUT SYSTEM
-- =====================================================
-- This migration implements Stripe Connect for automated payouts
-- to event organizers with platform fee handling

-- =====================================================
-- 1. ENHANCE SPONSORSHIP ORDERS FOR STRIPE CONNECT
-- =====================================================

-- Add Stripe Connect specific columns to sponsorship_orders
ALTER TABLE public.sponsorship_orders 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
ADD COLUMN IF NOT EXISTS stripe_charge_id text,
ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
ADD COLUMN IF NOT EXISTS transfer_group text,
ADD COLUMN IF NOT EXISTS application_fee_cents integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS organizer_stripe_account_id text,
ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending' CHECK (payout_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
ADD COLUMN IF NOT EXISTS payout_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_payout_attempt_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS payout_failure_reason text;

-- =====================================================
-- 2. CREATE PAYOUT TRACKING TABLE
-- =====================================================

-- Table to track payout attempts and status
CREATE TABLE IF NOT EXISTS public.sponsorship_payouts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  organizer_id uuid NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  application_fee_cents integer NOT NULL DEFAULT 0 CHECK (application_fee_cents >= 0),
  stripe_transfer_id text,
  stripe_payout_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  failure_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT sponsorship_payouts_pkey PRIMARY KEY (id),
  CONSTRAINT sponsorship_payouts_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sponsorship_orders(id) ON DELETE CASCADE,
  CONSTRAINT sponsorship_payouts_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);

-- =====================================================
-- 3. CREATE PAYOUT CONFIGURATION TABLE
-- =====================================================

-- Table to store payout configuration and rules
CREATE TABLE IF NOT EXISTS public.payout_configurations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  stripe_connect_account_id text NOT NULL,
  platform_fee_percentage numeric(5,4) NOT NULL DEFAULT 0.05 CHECK (platform_fee_percentage >= 0 AND platform_fee_percentage <= 1),
  minimum_payout_amount_cents integer NOT NULL DEFAULT 1000 CHECK (minimum_payout_amount_cents > 0),
  payout_schedule text NOT NULL DEFAULT 'manual' CHECK (payout_schedule IN ('manual', 'daily', 'weekly', 'monthly')),
  auto_payout_enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payout_configurations_pkey PRIMARY KEY (id),
  CONSTRAINT payout_configurations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  CONSTRAINT payout_configurations_unique_org UNIQUE (organization_id)
);

-- =====================================================
-- 4. CREATE PAYOUT QUEUE TABLE
-- =====================================================

-- Table to queue payouts for processing
CREATE TABLE IF NOT EXISTS public.payout_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  priority integer DEFAULT 0 CHECK (priority >= 0),
  scheduled_for timestamp with time zone NOT NULL DEFAULT now(),
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT payout_queue_pkey PRIMARY KEY (id),
  CONSTRAINT payout_queue_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.sponsorship_orders(id) ON DELETE CASCADE
);

-- =====================================================
-- 5. CREATE PAYOUT FUNCTIONS
-- =====================================================

-- Function to calculate platform fees
CREATE OR REPLACE FUNCTION public.calculate_platform_fee(
  p_amount_cents integer,
  p_organization_id uuid
)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  fee_percentage numeric;
  fee_cents integer;
BEGIN
  -- Get the platform fee percentage for the organization
  SELECT COALESCE(platform_fee_percentage, 0.05)
  INTO fee_percentage
  FROM public.payout_configurations
  WHERE organization_id = p_organization_id;
  
  -- Calculate fee (minimum 1 cent)
  fee_cents := GREATEST(1, ROUND(p_amount_cents * fee_percentage));
  
  -- Ensure fee doesn't exceed 50% of the amount
  fee_cents := LEAST(fee_cents, p_amount_cents / 2);
  
  RETURN fee_cents;
END $$;

-- Function to queue a payout
CREATE OR REPLACE FUNCTION public.queue_sponsorship_payout(
  p_order_id uuid,
  p_priority integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  queue_id uuid;
  order_record record;
BEGIN
  -- Get order details
  SELECT so.*, e.owner_context_id as organizer_id
  INTO order_record
  FROM public.sponsorship_orders so
  JOIN public.events e ON e.id = so.event_id
  WHERE so.id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_id;
  END IF;
  
  -- Check if already queued
  IF EXISTS (SELECT 1 FROM public.payout_queue WHERE order_id = p_order_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Payout already queued for order: %', p_order_id;
  END IF;
  
  -- Insert into queue
  INSERT INTO public.payout_queue (order_id, priority, scheduled_for)
  VALUES (p_order_id, p_priority, now())
  RETURNING id INTO queue_id;
  
  -- Update order status
  UPDATE public.sponsorship_orders
  SET payout_status = 'processing'
  WHERE id = p_order_id;
  
  RETURN queue_id;
END $$;

-- Function to process payout queue
CREATE OR REPLACE FUNCTION public.process_payout_queue()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  queue_item record;
  processed_count integer := 0;
  fee_cents integer;
  organizer_amount integer;
BEGIN
  -- Process pending payouts in priority order
  FOR queue_item IN 
    SELECT pq.*, so.*, e.owner_context_id as organizer_id
    FROM public.payout_queue pq
    JOIN public.sponsorship_orders so ON so.id = pq.order_id
    JOIN public.events e ON e.id = so.event_id
    WHERE pq.status = 'pending' 
    AND pq.scheduled_for <= now()
    AND pq.attempts < pq.max_attempts
    ORDER BY pq.priority DESC, pq.created_at ASC
    LIMIT 10
  LOOP
    BEGIN
      -- Calculate platform fee
      fee_cents := public.calculate_platform_fee(queue_item.amount_cents, queue_item.organizer_id);
      organizer_amount := queue_item.amount_cents - fee_cents;
      
      -- Update queue item status
      UPDATE public.payout_queue
      SET status = 'processing', attempts = attempts + 1
      WHERE id = queue_item.id;
      
      -- Create payout record
      INSERT INTO public.sponsorship_payouts (
        order_id,
        organizer_id,
        amount_cents,
        application_fee_cents,
        status
      ) VALUES (
        queue_item.order_id,
        queue_item.organizer_id,
        organizer_amount,
        fee_cents,
        'processing'
      );
      
      -- Update queue status
      UPDATE public.payout_queue
      SET status = 'completed', processed_at = now()
      WHERE id = queue_item.id;
      
      -- Update order status
      UPDATE public.sponsorship_orders
      SET payout_status = 'completed'
      WHERE id = queue_item.order_id;
      
      processed_count := processed_count + 1;
      
    EXCEPTION
      WHEN OTHERS THEN
        -- Mark as failed
        UPDATE public.payout_queue
        SET status = 'failed', 
            error_message = SQLERRM,
            processed_at = now()
        WHERE id = queue_item.id;
        
        -- Update order status
        UPDATE public.sponsorship_orders
        SET payout_status = 'failed',
            payout_failure_reason = SQLERRM
        WHERE id = queue_item.order_id;
    END;
  END LOOP;
  
  RETURN processed_count;
END $$;

-- =====================================================
-- 6. CREATE INDEXES
-- =====================================================

-- Indexes for payout_queue
CREATE INDEX IF NOT EXISTS idx_payout_queue_status_scheduled 
ON public.payout_queue (status, scheduled_for) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_payout_queue_priority 
ON public.payout_queue (priority DESC, created_at);

-- Indexes for sponsorship_payouts
CREATE INDEX IF NOT EXISTS idx_sponsorship_payouts_order_id 
ON public.sponsorship_payouts (order_id);

CREATE INDEX IF NOT EXISTS idx_sponsorship_payouts_organizer_id 
ON public.sponsorship_payouts (organizer_id);

CREATE INDEX IF NOT EXISTS idx_sponsorship_payouts_status 
ON public.sponsorship_payouts (status);

-- Indexes for payout_configurations
CREATE INDEX IF NOT EXISTS idx_payout_configurations_organization_id 
ON public.payout_configurations (organization_id);

-- =====================================================
-- 7. ENABLE RLS
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE public.sponsorship_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_queue ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies
CREATE POLICY "Organizers can view their payouts" ON public.sponsorship_payouts 
FOR SELECT USING (organizer_id IN (
  SELECT id FROM public.organizations 
  WHERE id IN (
    SELECT org_id FROM public.org_memberships 
    WHERE user_id = auth.uid()
  )
));

CREATE POLICY "Organizers can view their payout configs" ON public.payout_configurations 
FOR ALL USING (organization_id IN (
  SELECT org_id FROM public.org_memberships 
  WHERE user_id = auth.uid()
));

-- =====================================================
-- 8. SCHEDULE PAYOUT PROCESSING
-- =====================================================

-- Schedule automatic payout processing
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'process-payout-queue',
      '*/5 * * * *', -- Run every 5 minutes
      'SELECT public.process_payout_queue();'
    );
    
    RAISE NOTICE 'Scheduled automatic payout processing';
  ELSE
    RAISE NOTICE 'pg_cron extension not available - manual payout processing required';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule payout processing: %', SQLERRM;
END $$;

-- =====================================================
-- 9. COMMENTS
-- =====================================================

COMMENT ON TABLE public.sponsorship_payouts IS 'Tracks individual payout transactions to organizers';
COMMENT ON TABLE public.payout_configurations IS 'Stores payout configuration for each organization';
COMMENT ON TABLE public.payout_queue IS 'Queue for processing payouts to organizers';
COMMENT ON FUNCTION public.calculate_platform_fee(integer, uuid) IS 'Calculates platform fee for a given amount and organization';
COMMENT ON FUNCTION public.queue_sponsorship_payout(uuid, integer) IS 'Queues a sponsorship payout for processing';
COMMENT ON FUNCTION public.process_payout_queue() IS 'Processes pending payouts from the queue';
