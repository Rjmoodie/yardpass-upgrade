-- Migration: Create Email Queue for Retry Logic
-- Created: 2025-01-28
-- Purpose: Persistent queue for email retries with exponential backoff

-- ============================================================================
-- EMAIL QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Email details
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  from_email TEXT DEFAULT 'Liventix <noreply@liventix.tech>',
  reply_to TEXT DEFAULT 'support@liventix.tech',
  
  -- Retry tracking
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter')),
  
  -- Error tracking
  last_error TEXT,
  error_count INT DEFAULT 0,
  
  -- Metadata
  email_type TEXT, -- 'purchase_confirmation', 'invite', 'reminder', etc.
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_queue_status_next_retry 
ON public.email_queue(status, next_retry_at) 
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_email_queue_to_email 
ON public.email_queue(to_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_queue_created_at 
ON public.email_queue(created_at DESC);

-- ============================================================================
-- UPDATE TIMESTAMP TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_email_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_email_queue_updated_at
BEFORE UPDATE ON public.email_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_email_queue_updated_at();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Service role can see all emails (for processing)
CREATE POLICY "email_queue_service_role_all"
ON public.email_queue FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users can see their own emails (for debugging)
CREATE POLICY "email_queue_users_select_own"
ON public.email_queue FOR SELECT
TO authenticated
USING (to_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- ============================================================================
-- HELPER FUNCTION: Calculate Next Retry Time
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_email_retry_time(attempt_number INT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  delay_seconds INT;
BEGIN
  -- Exponential backoff: 1s, 5s, 30s, 5min, 30min
  CASE attempt_number
    WHEN 0 THEN delay_seconds := 1;      -- First retry after 1 second
    WHEN 1 THEN delay_seconds := 5;      -- Second retry after 5 seconds
    WHEN 2 THEN delay_seconds := 30;     -- Third retry after 30 seconds
    WHEN 3 THEN delay_seconds := 300;    -- Fourth retry after 5 minutes
    WHEN 4 THEN delay_seconds := 1800;   -- Fifth retry after 30 minutes
    ELSE delay_seconds := 3600;          -- After that, 1 hour intervals
  END CASE;
  
  RETURN now() + (delay_seconds || ' seconds')::INTERVAL;
END;
$$;

COMMENT ON FUNCTION public.calculate_email_retry_time IS 'Calculate next retry time with exponential backoff for email queue';

-- ============================================================================
-- HELPER FUNCTION: Get Next Batch of Emails to Process
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_email_queue_batch(batch_size INT DEFAULT 50)
RETURNS TABLE (
  id UUID,
  to_email TEXT,
  subject TEXT,
  html TEXT,
  from_email TEXT,
  reply_to TEXT,
  attempts INT,
  max_attempts INT,
  email_type TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_ids UUID[];
BEGIN
  -- Select emails that are ready to retry (pending status and next_retry_at <= now)
  -- Also select emails that haven't been processed yet (next_retry_at is null)
  -- Lock rows to prevent concurrent processing
  SELECT ARRAY_AGG(id) INTO email_ids
  FROM public.email_queue
  WHERE status = 'pending'
    AND (next_retry_at IS NULL OR next_retry_at <= now())
  ORDER BY created_at ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED; -- Prevent concurrent processing of same email
  
  -- Update status to 'processing'
  UPDATE public.email_queue
  SET status = 'processing',
      updated_at = now()
  WHERE id = ANY(email_ids);
  
  -- Return the emails to process
  RETURN QUERY
  SELECT 
    eq.id,
    eq.to_email,
    eq.subject,
    eq.html,
    eq.from_email,
    eq.reply_to,
    eq.attempts,
    eq.max_attempts,
    eq.email_type,
    eq.metadata
  FROM public.email_queue eq
  WHERE eq.id = ANY(email_ids);
END;
$$;

COMMENT ON FUNCTION public.get_email_queue_batch IS 'Get next batch of emails to process, marking them as processing';

-- ============================================================================
-- HELPER FUNCTION: Mark Email as Sent
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_email_sent(email_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_queue
  SET 
    status = 'sent',
    sent_at = now(),
    updated_at = now()
  WHERE id = email_id;
END;
$$;

COMMENT ON FUNCTION public.mark_email_sent IS 'Mark an email as successfully sent';

-- ============================================================================
-- HELPER FUNCTION: Mark Email as Failed and Schedule Retry
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_email_failed(
  email_id UUID,
  error_message TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_attempts INT;
  current_max_attempts INT;
  new_attempts INT;
BEGIN
  -- Get current attempt count
  SELECT attempts, max_attempts 
  INTO current_attempts, current_max_attempts
  FROM public.email_queue
  WHERE id = email_id;
  
  new_attempts := COALESCE(current_attempts, 0) + 1;
  
  -- If max attempts reached, move to dead letter
  IF new_attempts >= COALESCE(current_max_attempts, 5) THEN
    UPDATE public.email_queue
    SET 
      status = 'dead_letter',
      failed_at = now(),
      last_error = error_message,
      error_count = new_attempts,
      updated_at = now()
    WHERE id = email_id;
  ELSE
    -- Schedule retry with exponential backoff
    UPDATE public.email_queue
    SET 
      status = 'pending',
      attempts = new_attempts,
      error_count = new_attempts,
      last_error = error_message,
      next_retry_at = public.calculate_email_retry_time(new_attempts - 1),
      updated_at = now()
    WHERE id = email_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.mark_email_failed IS 'Mark an email as failed and schedule retry with exponential backoff';

-- ============================================================================
-- VERIFY MIGRATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Email queue migration complete:';
  RAISE NOTICE '   - email_queue table created';
  RAISE NOTICE '   - RLS policies configured';
  RAISE NOTICE '   - Helper functions created';
  RAISE NOTICE '   - Indexes added for performance';
END $$;

