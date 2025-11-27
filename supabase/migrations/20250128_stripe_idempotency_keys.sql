-- Phase 2.2.4: Stripe Idempotency Key Management
-- Tracks idempotency keys with database enforcement

-- Table to track idempotency keys for Stripe operations
CREATE TABLE IF NOT EXISTS public.stripe_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL, -- e.g., 'checkout:create', 'payout:create'
  operation_id TEXT NOT NULL,   -- Stable internal ID (order_id, payout_id, etc.)
  stripe_idempotency_key TEXT NOT NULL UNIQUE, -- The actual key sent to Stripe
  stripe_resource_id TEXT, -- Stripe resource ID returned (session.id, payout.id, etc.)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB, -- Additional context (order_id, event_id, etc.)
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ, -- When this key expires (24h for Stripe)
  
  -- Prevent duplicate operations: same operation_type + operation_id = duplicate
  UNIQUE(operation_type, operation_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_stripe_idempotency_keys_operation 
ON public.stripe_idempotency_keys(operation_type, operation_id);

CREATE INDEX IF NOT EXISTS idx_stripe_idempotency_keys_stripe_key 
ON public.stripe_idempotency_keys(stripe_idempotency_key);

CREATE INDEX IF NOT EXISTS idx_stripe_idempotency_keys_user 
ON public.stripe_idempotency_keys(user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stripe_idempotency_keys_expires 
ON public.stripe_idempotency_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS
ALTER TABLE public.stripe_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Service role can see all, users can see their own
CREATE POLICY "stripe_idempotency_keys_service_role_all"
  ON public.stripe_idempotency_keys FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "stripe_idempotency_keys_users_select_own"
  ON public.stripe_idempotency_keys FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Function to check if operation is already completed (idempotent)
-- Returns the Stripe resource ID if already completed, null otherwise
CREATE OR REPLACE FUNCTION public.check_stripe_idempotency(
  p_operation_type TEXT,
  p_operation_id TEXT
)
RETURNS TABLE(
  is_completed BOOLEAN,
  stripe_resource_id TEXT,
  stripe_idempotency_key TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    true as is_completed,
    sik.stripe_resource_id,
    sik.stripe_idempotency_key,
    sik.created_at
  FROM public.stripe_idempotency_keys sik
  WHERE sik.operation_type = p_operation_type
    AND sik.operation_id = p_operation_id
    AND (sik.expires_at IS NULL OR sik.expires_at > NOW())
  LIMIT 1;
  
  -- If no row found, return false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.check_stripe_idempotency IS 
  'Checks if a Stripe operation has already been completed. Returns the Stripe resource ID if found, allowing idempotent retries.';

-- Function to record a completed idempotency operation
CREATE OR REPLACE FUNCTION public.record_stripe_idempotency(
  p_operation_type TEXT,
  p_operation_id TEXT,
  p_stripe_idempotency_key TEXT,
  p_stripe_resource_id TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.stripe_idempotency_keys (
    operation_type,
    operation_id,
    stripe_idempotency_key,
    stripe_resource_id,
    user_id,
    metadata,
    expires_at
  ) VALUES (
    p_operation_type,
    p_operation_id,
    p_stripe_idempotency_key,
    p_stripe_resource_id,
    p_user_id,
    p_metadata,
    p_expires_at
  )
  ON CONFLICT (operation_type, operation_id) 
  DO UPDATE SET
    stripe_idempotency_key = EXCLUDED.stripe_idempotency_key,
    stripe_resource_id = COALESCE(EXCLUDED.stripe_resource_id, stripe_idempotency_keys.stripe_resource_id),
    metadata = COALESCE(EXCLUDED.metadata, stripe_idempotency_keys.metadata),
    expires_at = EXCLUDED.expires_at
  RETURNING id INTO v_id;
  
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  -- Return NULL on error (e.g., unique constraint violation on stripe_idempotency_key)
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.record_stripe_idempotency IS 
  'Records a completed Stripe operation for idempotency tracking. Returns the record ID, or NULL on conflict.';

-- Function to clean up expired idempotency keys (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.stripe_idempotency_keys
  WHERE expires_at IS NOT NULL 
    AND expires_at < NOW() - INTERVAL '7 days'; -- Keep for 7 days after expiry
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_idempotency_keys IS 
  'Cleans up expired idempotency keys (removed 7 days after expiry). Returns count of deleted records.';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_stripe_idempotency(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_stripe_idempotency(TEXT, TEXT, TEXT, TEXT, UUID, JSONB, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_idempotency_keys() TO service_role;

-- Comments
COMMENT ON TABLE public.stripe_idempotency_keys IS 
  'Tracks idempotency keys for Stripe operations to prevent duplicate charges and ensure idempotent retries.';

COMMENT ON COLUMN public.stripe_idempotency_keys.operation_type IS 
  'Type of operation: checkout:create, payout:create, refund:create, etc.';

COMMENT ON COLUMN public.stripe_idempotency_keys.operation_id IS 
  'Stable internal identifier for the operation (order_id, payout_id, etc.). Combined with operation_type, ensures uniqueness.';

COMMENT ON COLUMN public.stripe_idempotency_keys.stripe_idempotency_key IS 
  'The actual idempotency key sent to Stripe API. Must be globally unique across all Stripe operations.';

COMMENT ON COLUMN public.stripe_idempotency_keys.stripe_resource_id IS 
  'The Stripe resource ID returned (e.g., session.id, payout.id). Used for idempotent retries.';

