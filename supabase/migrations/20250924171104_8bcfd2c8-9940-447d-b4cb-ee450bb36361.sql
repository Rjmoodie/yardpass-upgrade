-- Complete Phase 4: Rate Limiting with Automated Cleanup and IP Hashing

-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add IP hash support to rate_limits table
ALTER TABLE public.rate_limits 
ADD COLUMN IF NOT EXISTS ip_hash TEXT;

-- Create index for IP-based lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_hash_minute 
ON public.rate_limits (ip_hash, minute) 
WHERE ip_hash IS NOT NULL;

-- Update cleanup function to handle IP-based entries
CREATE OR REPLACE FUNCTION public.cleanup_old_keys()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Clean up old idempotency keys (24 hours)
  DELETE FROM public.idempotency_keys 
  WHERE created_at < NOW() - INTERVAL '24 hours';
  
  -- Clean up old rate limits (1 hour)
  DELETE FROM public.rate_limits 
  WHERE minute < NOW() - INTERVAL '1 hour';
  
  -- Log cleanup activity
  RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$;

-- Schedule automated cleanup to run every 15 minutes
SELECT cron.schedule(
  'cleanup-rate-limits-and-keys',
  '*/15 * * * *', -- every 15 minutes
  $$
  SELECT public.cleanup_old_keys();
  $$
);

-- Helper function for IP hashing (for privacy)
CREATE OR REPLACE FUNCTION public.hash_ip(ip_address TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  -- Simple hash for IP privacy (you can enhance this with a salt)
  RETURN encode(digest(ip_address || 'rate_limit_salt', 'sha256'), 'hex');
END;
$$;

-- Function to check rate limits (supports both user and IP-based)
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_bucket TEXT,
  p_user_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_max_per_minute INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_minute TIMESTAMP WITH TIME ZONE;
  v_current_count INTEGER := 0;
  v_ip_hash TEXT;
  v_result JSONB;
BEGIN
  -- Get current minute window
  v_current_minute := DATE_TRUNC('minute', NOW());
  
  -- Hash IP if provided
  IF p_ip_address IS NOT NULL THEN
    v_ip_hash := hash_ip(p_ip_address);
  END IF;
  
  -- Check existing count for this minute
  SELECT COALESCE(count, 0) INTO v_current_count
  FROM public.rate_limits
  WHERE bucket = p_bucket
    AND minute = v_current_minute
    AND (
      (p_user_id IS NOT NULL AND user_id = p_user_id) OR
      (p_ip_address IS NOT NULL AND ip_hash = v_ip_hash)
    );
  
  -- Check if limit exceeded
  IF v_current_count >= p_max_per_minute THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current_count', v_current_count,
      'limit', p_max_per_minute,
      'reset_at', v_current_minute + INTERVAL '1 minute'
    );
  END IF;
  
  -- Increment counter
  INSERT INTO public.rate_limits (user_id, ip_hash, bucket, minute, count)
  VALUES (
    p_user_id,
    v_ip_hash,
    p_bucket,
    v_current_minute,
    v_current_count + 1
  )
  ON CONFLICT (user_id, bucket, minute) 
  DO UPDATE SET count = rate_limits.count + 1
  WHERE rate_limits.user_id IS NOT NULL;
  
  -- Handle IP-based conflict separately (since user_id might be NULL)
  IF p_ip_address IS NOT NULL AND p_user_id IS NULL THEN
    INSERT INTO public.rate_limits (user_id, ip_hash, bucket, minute, count)
    VALUES (
      NULL,
      v_ip_hash,
      p_bucket,
      v_current_minute,
      v_current_count + 1
    )
    ON CONFLICT (COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::UUID), bucket, minute)
    DO UPDATE SET count = rate_limits.count + 1
    WHERE rate_limits.ip_hash = v_ip_hash;
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'current_count', v_current_count + 1,
    'limit', p_max_per_minute,
    'reset_at', v_current_minute + INTERVAL '1 minute'
  );
END;
$$;

-- Update RLS policies to handle IP-based entries
DROP POLICY IF EXISTS "Users can only access own rate limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Service role can manage rate limits" ON public.rate_limits;

CREATE POLICY "Users can access own rate limits or IP entries"
ON public.rate_limits
FOR ALL
USING (
  user_id = auth.uid() OR 
  (user_id IS NULL AND ip_hash IS NOT NULL) OR
  auth.role() = 'service_role'
)
WITH CHECK (
  user_id = auth.uid() OR
  (user_id IS NULL AND ip_hash IS NOT NULL) OR
  auth.role() = 'service_role'
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.cleanup_old_keys() TO service_role;
GRANT EXECUTE ON FUNCTION public.hash_ip(TEXT) TO service_role, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, UUID, TEXT, INTEGER) TO service_role, authenticated, anon;