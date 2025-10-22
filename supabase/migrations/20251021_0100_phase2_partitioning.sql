-- =====================================================
-- PHASE 2: SCALE & MONEY FLOW - TABLE PARTITIONING
-- =====================================================
-- This migration implements table partitioning for high-volume tables
-- to improve query performance and enable data lifecycle management

-- =====================================================
-- 1. PARTITION EVENT_IMPRESSIONS TABLE
-- =====================================================

-- Create partitioned parent table for event_impressions
CREATE TABLE IF NOT EXISTS public.event_impressions_p (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid,
  session_id text CHECK (session_id IS NULL OR length(session_id) >= 16 AND length(session_id) <= 64),
  dwell_ms integer DEFAULT 0 CHECK (dwell_ms >= 0 AND dwell_ms <= (60 * 60 * 1000)),
  completed boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  -- New Primary Key including partitioning column
  CONSTRAINT event_impressions_p_pkey PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE public.event_impressions_p IS 'Partitioned event_impressions by month for improved query performance';

-- Create monthly partitions for last 18 months + current & next month
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

-- Copy data from existing table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_impressions' AND table_schema = 'public') THEN
    INSERT INTO public.event_impressions_p
    SELECT * FROM public.event_impressions
    ON CONFLICT (id, created_at) DO NOTHING;
    
    RAISE NOTICE 'Copied data from event_impressions to partitioned table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not copy data from event_impressions: %', SQLERRM;
END $$;

-- =====================================================
-- 2. PARTITION TICKET_ANALYTICS TABLE
-- =====================================================

-- Create partitioned parent table for ticket_analytics
CREATE TABLE IF NOT EXISTS public.ticket_analytics_p (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['ticket_view'::text, 'qr_code_view'::text, 'ticket_share'::text, 'ticket_copy'::text, 'wallet_download'::text])),
  ticket_id uuid NOT NULL,
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  -- New Primary Key including partitioning column
  CONSTRAINT ticket_analytics_p_pkey PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

COMMENT ON TABLE public.ticket_analytics_p IS 'Partitioned ticket_analytics by month for improved query performance';

-- Create monthly partitions for ticket_analytics
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

-- Copy data from existing table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ticket_analytics' AND table_schema = 'public') THEN
    INSERT INTO public.ticket_analytics_p
    SELECT * FROM public.ticket_analytics
    ON CONFLICT (id, created_at) DO NOTHING;
    
    RAISE NOTICE 'Copied data from ticket_analytics to partitioned table';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not copy data from ticket_analytics: %', SQLERRM;
END $$;

-- =====================================================
-- 3. CREATE PARTITION MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to create next month's partitions
CREATE OR REPLACE FUNCTION public.create_next_month_partitions()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  next_month date := date_trunc('month', now() + interval '1 month');
  partition_name text;
BEGIN
  -- Create event_impressions partition
  partition_name := 'event_impressions_p_' || to_char(next_month, 'YYYYMM');
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.event_impressions_p
       FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      next_month::timestamptz,
      (next_month + interval '1 month')::timestamptz
    );
    
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;

  -- Create ticket_analytics partition
  partition_name := 'ticket_analytics_p_' || to_char(next_month, 'YYYYMM');
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.ticket_analytics_p
       FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      next_month::timestamptz,
      (next_month + interval '1 month')::timestamptz
    );
    
    RAISE NOTICE 'Created partition: %', partition_name;
  END IF;
END $$;

-- =====================================================
-- 4. SCHEDULE PARTITION CREATION
-- =====================================================

-- Schedule automatic partition creation (requires pg_cron extension)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'create-next-month-partitions',
      '0 0 1 * *', -- Run on the 1st of every month
      'SELECT public.create_next_month_partitions();'
    );
    
    RAISE NOTICE 'Scheduled automatic partition creation';
  ELSE
    RAISE NOTICE 'pg_cron extension not available - manual partition management required';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule partition creation: %', SQLERRM;
END $$;

-- =====================================================
-- 5. CREATE DEFAULT PARTITIONS
-- =====================================================

-- Create default partitions for future data
CREATE TABLE IF NOT EXISTS public.event_impressions_default
PARTITION OF public.event_impressions_p DEFAULT;

CREATE TABLE IF NOT EXISTS public.ticket_analytics_default
PARTITION OF public.ticket_analytics_p DEFAULT;

COMMENT ON TABLE public.event_impressions_default IS 'Default partition for event_impressions outside defined monthly ranges';
COMMENT ON TABLE public.ticket_analytics_default IS 'Default partition for ticket_analytics outside defined monthly ranges';

-- =====================================================
-- 6. RECREATE FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Add foreign key constraints to partitioned tables
ALTER TABLE public.event_impressions_p 
ADD CONSTRAINT event_impressions_p_event_id_fkey 
FOREIGN KEY (event_id) REFERENCES public.events(id);

ALTER TABLE public.event_impressions_p 
ADD CONSTRAINT event_impressions_p_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public.ticket_analytics_p 
ADD CONSTRAINT ticket_analytics_p_ticket_id_fkey 
FOREIGN KEY (ticket_id) REFERENCES public.tickets(id);

ALTER TABLE public.ticket_analytics_p 
ADD CONSTRAINT ticket_analytics_p_event_id_fkey 
FOREIGN KEY (event_id) REFERENCES public.events(id);

ALTER TABLE public.ticket_analytics_p 
ADD CONSTRAINT ticket_analytics_p_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- =====================================================
-- 7. CREATE PARTITION-SPECIFIC INDEXES
-- =====================================================

-- Create indexes on partitioned tables
CREATE INDEX IF NOT EXISTS idx_event_impressions_p_event_id_created_at 
ON public.event_impressions_p (event_id, created_at);

CREATE INDEX IF NOT EXISTS idx_event_impressions_p_user_id_created_at 
ON public.event_impressions_p (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ticket_analytics_p_event_id_created_at 
ON public.ticket_analytics_p (event_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ticket_analytics_p_user_id_created_at 
ON public.ticket_analytics_p (user_id, created_at);

-- =====================================================
-- 8. COMMENTS
-- =====================================================

COMMENT ON FUNCTION public.create_next_month_partitions() IS 'Creates partitions for the next month to ensure continuous data storage';
