-- Migration: Create Webhook Retry Queue
-- Created: 2025-01-28
-- Purpose: Dead letter queue for failed webhook processing with automatic retries

-- ============================================================================
-- WEBHOOK RETRY QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Webhook identification
  webhook_type TEXT NOT NULL, -- 'stripe', 'resend', etc.
  webhook_event_id TEXT, -- Stripe event ID, etc.
  
  -- Original payload
  payload JSONB NOT NULL,
  headers JSONB DEFAULT '{}'::jsonb,
  
  -- Retry tracking
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'dead_letter')),
  
  -- Error tracking
  last_error TEXT,
  error_count INT DEFAULT 0,
  last_error_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_queue_status_next_retry 
ON public.webhook_retry_queue(status, next_retry_at) 
WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_webhook_queue_type 
ON public.webhook_retry_queue(webhook_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_queue_event_id 
ON public.webhook_retry_queue(webhook_event_id) 
WHERE webhook_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_queue_created_at 
ON public.webhook_retry_queue(created_at DESC);

-- ============================================================================
-- UPDATE TIMESTAMP TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_webhook_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_webhook_queue_updated_at
BEFORE UPDATE ON public.webhook_retry_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_webhook_queue_updated_at();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE public.webhook_retry_queue ENABLE ROW LEVEL SECURITY;

-- Service role can see all webhooks (for processing)
CREATE POLICY "webhook_queue_service_role_all"
ON public.webhook_retry_queue FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Prevent public access (webhooks are internal)
CREATE POLICY "webhook_queue_deny_public"
ON public.webhook_retry_queue FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- ============================================================================
-- HELPER FUNCTION: Calculate Next Retry Time
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_webhook_retry_time(attempt_number INT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  delay_seconds INT;
BEGIN
  -- Exponential backoff: 1min, 5min, 30min, 2hr, 24hr
  CASE attempt_number
    WHEN 0 THEN delay_seconds := 60;       -- First retry after 1 minute
    WHEN 1 THEN delay_seconds := 300;      -- Second retry after 5 minutes
    WHEN 2 THEN delay_seconds := 1800;     -- Third retry after 30 minutes
    WHEN 3 THEN delay_seconds := 7200;     -- Fourth retry after 2 hours
    WHEN 4 THEN delay_seconds := 86400;    -- Fifth retry after 24 hours
    ELSE delay_seconds := 86400;           -- After that, daily
  END CASE;
  
  RETURN now() + (delay_seconds || ' seconds')::INTERVAL;
END;
$$;

COMMENT ON FUNCTION public.calculate_webhook_retry_time IS 'Calculate next retry time with exponential backoff for webhook queue';

-- ============================================================================
-- HELPER FUNCTION: Get Next Batch of Webhooks to Process
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_webhook_retry_batch(batch_size INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  webhook_type TEXT,
  webhook_event_id TEXT,
  payload JSONB,
  headers JSONB,
  attempts INT,
  max_attempts INT,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  webhook_ids UUID[];
BEGIN
  -- Select webhooks that are ready to retry (pending status and next_retry_at <= now)
  -- Lock rows to prevent concurrent processing
  SELECT ARRAY_AGG(id) INTO webhook_ids
  FROM public.webhook_retry_queue
  WHERE status = 'pending'
    AND (next_retry_at IS NULL OR next_retry_at <= now())
  ORDER BY created_at ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED; -- Prevent concurrent processing
  
  -- Update status to 'processing'
  UPDATE public.webhook_retry_queue
  SET status = 'processing',
      updated_at = now()
  WHERE id = ANY(webhook_ids);
  
  -- Return the webhooks to process
  RETURN QUERY
  SELECT 
    wq.id,
    wq.webhook_type,
    wq.webhook_event_id,
    wq.payload,
    wq.headers,
    wq.attempts,
    wq.max_attempts,
    wq.metadata
  FROM public.webhook_retry_queue wq
  WHERE wq.id = ANY(webhook_ids);
END;
$$;

COMMENT ON FUNCTION public.get_webhook_retry_batch IS 'Get next batch of webhooks to retry, marking them as processing';

-- ============================================================================
-- HELPER FUNCTION: Mark Webhook as Processed
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_webhook_processed(webhook_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.webhook_retry_queue
  SET 
    status = 'processed',
    processed_at = now(),
    updated_at = now()
  WHERE id = webhook_id;
END;
$$;

COMMENT ON FUNCTION public.mark_webhook_processed IS 'Mark a webhook as successfully processed';

-- ============================================================================
-- HELPER FUNCTION: Mark Webhook as Failed and Schedule Retry
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_webhook_failed(
  webhook_id UUID,
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
  FROM public.webhook_retry_queue
  WHERE id = webhook_id;
  
  new_attempts := COALESCE(current_attempts, 0) + 1;
  
  -- If max attempts reached, move to dead letter
  IF new_attempts >= COALESCE(current_max_attempts, 5) THEN
    UPDATE public.webhook_retry_queue
    SET 
      status = 'dead_letter',
      failed_at = now(),
      last_error = error_message,
      error_count = new_attempts,
      last_error_at = now(),
      updated_at = now()
    WHERE id = webhook_id;
  ELSE
    -- Schedule retry with exponential backoff
    UPDATE public.webhook_retry_queue
    SET 
      status = 'pending',
      attempts = new_attempts,
      error_count = new_attempts,
      last_error = error_message,
      last_error_at = now(),
      next_retry_at = public.calculate_webhook_retry_time(new_attempts - 1),
      updated_at = now()
    WHERE id = webhook_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.mark_webhook_failed IS 'Mark a webhook as failed and schedule retry with exponential backoff';

-- ============================================================================
-- VERIFY MIGRATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Webhook retry queue migration complete:';
  RAISE NOTICE '   - webhook_retry_queue table created';
  RAISE NOTICE '   - RLS policies configured';
  RAISE NOTICE '   - Helper functions created';
  RAISE NOTICE '   - Indexes added for performance';
END $$;

