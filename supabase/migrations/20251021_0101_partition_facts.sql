-- =========== PHASE 2A: PARTITION BIG FACT TABLES ===========
-- Safe rollout with atomic swap; run during low-traffic window
-- Partitioning improves query performance and enables easier data lifecycle management

-- IMPORTANT: Partitioned tables cannot have unique constraints unless they include the partition key.
-- This means PRIMARY KEY (id) becomes PRIMARY KEY (id, created_at) on partitioned tables.
-- Foreign keys pointing to these tables may need adjustment.

-- =========== PARTITION: event_impressions ===========

-- 1) Create partitioned parent table (without constraints that don't include partition key)
CREATE TABLE IF NOT EXISTS public.event_impressions_p (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  user_id uuid,
  session_id text CHECK (session_id IS NULL OR length(session_id) >= 16 AND length(session_id) <= 64),
  placement text NOT NULL,  -- Assuming this is the placement type
  event_id uuid,
  post_id uuid,
  user_agent text,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  creative_id uuid,
  -- Primary key MUST include partition column
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE public.event_impressions_p IS 'Partitioned event_impressions by month for improved query performance';

-- 2) Create monthly partitions for last 18 months + current & next month
DO $$
DECLARE
  m date := date_trunc('month', now() - interval '18 months');
  partition_name text;
BEGIN
  WHILE m <= date_trunc('month', now() + interval '1 month') LOOP
    partition_name := 'event_impressions_p_' || to_char(m, 'YYYYMM');
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = partition_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.event_impressions_p
         FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        m::timestamptz,
        (m + interval '1 month')::timestamptz
      );
      
      RAISE NOTICE 'Created partition: %', partition_name;
    END IF;
    
    m := m + interval '1 month';
  END LOOP;
END $$;

-- 3) Create indexes on partitioned table (will be created on all partitions)
CREATE INDEX IF NOT EXISTS idx_event_impressions_p_campaign
  ON public.event_impressions_p (campaign_id, created_at);
CREATE INDEX IF NOT EXISTS idx_event_impressions_p_user
  ON public.event_impressions_p (user_id, created_at) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_impressions_p_event
  ON public.event_impressions_p (event_id, created_at) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_impressions_p_created
  ON public.event_impressions_p (created_at);

-- 4) Copy data
INSERT INTO public.event_impressions_p 
SELECT * FROM public.event_impressions;

-- 5) Atomic swap
ALTER TABLE public.event_impressions RENAME TO event_impressions_old;
ALTER TABLE public.event_impressions_p RENAME TO event_impressions;

-- 6) Default partition
CREATE TABLE IF NOT EXISTS public.event_impressions_default 
PARTITION OF public.event_impressions DEFAULT;

-- =========== PARTITION: ticket_analytics ===========

CREATE TABLE IF NOT EXISTS public.ticket_analytics_p (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['ticket_view'::text, 'qr_code_view'::text, 'ticket_share'::text, 'ticket_copy'::text, 'wallet_download'::text])),
  ticket_id uuid NOT NULL,
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE public.ticket_analytics_p IS 'Partitioned ticket_analytics by month';

DO $$
DECLARE
  m date := date_trunc('month', now() - interval '18 months');
  partition_name text;
BEGIN
  WHILE m <= date_trunc('month', now() + interval '1 month') LOOP
    partition_name := 'ticket_analytics_p_' || to_char(m, 'YYYYMM');
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = partition_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.ticket_analytics_p
         FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        m::timestamptz,
        (m + interval '1 month')::timestamptz
      );
      
      RAISE NOTICE 'Created partition: %', partition_name;
    END IF;
    
    m := m + interval '1 month';
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_ticket_analytics_p_ticket
  ON public.ticket_analytics_p (ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_p_event
  ON public.ticket_analytics_p (event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_analytics_p_user
  ON public.ticket_analytics_p (user_id, created_at);

INSERT INTO public.ticket_analytics_p 
SELECT * FROM public.ticket_analytics;

ALTER TABLE public.ticket_analytics RENAME TO ticket_analytics_old;
ALTER TABLE public.ticket_analytics_p RENAME TO ticket_analytics;

CREATE TABLE IF NOT EXISTS public.ticket_analytics_default 
PARTITION OF public.ticket_analytics DEFAULT;

-- =========== PARTITION: orders ===========

CREATE TABLE IF NOT EXISTS public.orders_p (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  subtotal_cents integer NOT NULL DEFAULT 0,
  fees_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD'::text CHECK (currency = ANY (ARRAY['USD'::text, 'EUR'::text, 'GBP'::text, 'CAD'::text])),
  stripe_session_id text,
  stripe_payment_intent_id text,
  payout_destination_owner text,
  payout_destination_id uuid,
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  hold_ids uuid[] DEFAULT '{}'::uuid[],
  tickets_issued_count integer DEFAULT 0,
  checkout_session_id text,
  contact_email text,
  contact_name text,
  contact_phone text,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE public.orders_p IS 'Partitioned orders by month';

DO $$
DECLARE
  m date := date_trunc('month', now() - interval '24 months');
  partition_name text;
BEGIN
  WHILE m <= date_trunc('month', now() + interval '1 month') LOOP
    partition_name := 'orders_p_' || to_char(m, 'YYYYMM');
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = partition_name
    ) THEN
      EXECUTE format(
        'CREATE TABLE public.%I PARTITION OF public.orders_p
         FOR VALUES FROM (%L) TO (%L)',
        partition_name,
        m::timestamptz,
        (m + interval '1 month')::timestamptz
      );
      
      RAISE NOTICE 'Created partition: %', partition_name;
    END IF;
    
    m := m + interval '1 month';
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_p_user
  ON public.orders_p (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_p_event
  ON public.orders_p (event_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_p_status
  ON public.orders_p (status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_p_stripe_session
  ON public.orders_p (stripe_session_id) WHERE stripe_session_id IS NOT NULL;

INSERT INTO public.orders_p 
SELECT * FROM public.orders;

ALTER TABLE public.orders RENAME TO orders_old;
ALTER TABLE public.orders_p RENAME TO orders;

CREATE TABLE IF NOT EXISTS public.orders_default 
PARTITION OF public.orders DEFAULT;

-- =========== VALIDATION ===========

DO $$
DECLARE
  old_count bigint;
  new_count bigint;
BEGIN
  SELECT COUNT(*) INTO old_count FROM public.event_impressions_old;
  SELECT COUNT(*) INTO new_count FROM public.event_impressions;
  RAISE NOTICE 'event_impressions: old=%, new=%', old_count, new_count;
  
  SELECT COUNT(*) INTO old_count FROM public.ticket_analytics_old;
  SELECT COUNT(*) INTO new_count FROM public.ticket_analytics;
  RAISE NOTICE 'ticket_analytics: old=%, new=%', old_count, new_count;
  
  SELECT COUNT(*) INTO old_count FROM public.orders_old;
  SELECT COUNT(*) INTO new_count FROM public.orders;
  RAISE NOTICE 'orders: old=%, new=%', old_count, new_count;
END $$;

-- =========== MAINTENANCE FUNCTION ===========

CREATE OR REPLACE FUNCTION public.create_next_month_partitions()
RETURNS void AS $$
DECLARE
  next_month date := date_trunc('month', now() + interval '1 month');
  partition_name text;
BEGIN
  -- event_impressions
  partition_name := 'event_impressions_p_' || to_char(next_month, 'YYYYMM');
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = partition_name) THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.event_impressions
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, next_month::timestamptz, (next_month + interval '1 month')::timestamptz
    );
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;
  
  -- ticket_analytics
  partition_name := 'ticket_analytics_p_' || to_char(next_month, 'YYYYMM');
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = partition_name) THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.ticket_analytics
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, next_month::timestamptz, (next_month + interval '1 month')::timestamptz
    );
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;
  
  -- orders
  partition_name := 'orders_p_' || to_char(next_month, 'YYYYMM');
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = partition_name) THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.orders
       FOR VALUES FROM (%L) TO (%L)',
      partition_name, next_month::timestamptz, (next_month + interval '1 month')::timestamptz
    );
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.create_next_month_partitions() IS 'Creates next month partitions for event_impressions, ticket_analytics, and orders';

-- Schedule monthly partition creation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'create-next-month-partitions',
      '0 2 1 * *',
      'SELECT public.create_next_month_partitions();'
    );
    RAISE NOTICE 'Scheduled monthly partition creation cron job';
  ELSE
    RAISE WARNING 'pg_cron extension not available. Schedule manually or install pg_cron.';
  END IF;
END $$;
