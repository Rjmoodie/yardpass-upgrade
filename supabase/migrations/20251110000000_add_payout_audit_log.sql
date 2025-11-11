-- Migration: Add payout audit log and request tracking
-- Purpose: Track all payout requests for rate limiting, fraud detection, and audit compliance
-- Date: November 10, 2025

-- Create payout_requests_log table
CREATE TABLE IF NOT EXISTS public.payout_requests_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_type text NOT NULL CHECK (context_type IN ('individual', 'organization')),
  context_id uuid NOT NULL,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  stripe_payout_id text,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  error_message text,
  error_code text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payout_requests_log_context 
  ON public.payout_requests_log(context_type, context_id);

CREATE INDEX IF NOT EXISTS idx_payout_requests_log_requested_by 
  ON public.payout_requests_log(requested_by);

CREATE INDEX IF NOT EXISTS idx_payout_requests_log_created_at 
  ON public.payout_requests_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_requests_log_status 
  ON public.payout_requests_log(status)
  WHERE status = 'pending';

-- Add RLS policies
ALTER TABLE public.payout_requests_log ENABLE ROW LEVEL SECURITY;

-- Policy: Platform admins can view all payout requests
CREATE POLICY payout_requests_log_platform_admin_select
  ON public.payout_requests_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users.user_profiles
      WHERE user_id = auth.uid()
      AND role = 'platform_admin'
    )
  );

-- Policy: Users can view their own payout requests
CREATE POLICY payout_requests_log_own_requests_select
  ON public.payout_requests_log
  FOR SELECT
  TO authenticated
  USING (requested_by = auth.uid());

-- Policy: Org admins/owners can view their org's payout requests
CREATE POLICY payout_requests_log_org_admin_select
  ON public.payout_requests_log
  FOR SELECT
  TO authenticated
  USING (
    context_type = 'organization'
    AND EXISTS (
      SELECT 1 FROM public.org_memberships
      WHERE org_id = payout_requests_log.context_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Create helper function to check payout rate limits
CREATE OR REPLACE FUNCTION public.check_payout_rate_limit(
  p_context_type text,
  p_context_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_count integer;
  max_requests integer := 3;
  window_hours integer := 1;
  window_start timestamptz;
BEGIN
  window_start := now() - (window_hours || ' hours')::interval;
  
  -- Count requests in the time window
  SELECT COUNT(*)
  INTO request_count
  FROM public.payout_requests_log
  WHERE context_type = p_context_type
    AND context_id = p_context_id
    AND created_at >= window_start
    AND status IN ('success', 'pending'); -- Don't count failures
  
  -- Return result
  IF request_count >= max_requests THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current_count', request_count,
      'max_requests', max_requests,
      'window_hours', window_hours,
      'retry_after', window_start + (window_hours || ' hours')::interval
    );
  ELSE
    RETURN jsonb_build_object(
      'allowed', true,
      'current_count', request_count,
      'max_requests', max_requests,
      'remaining', max_requests - request_count
    );
  END IF;
END;
$$;

-- Grant permissions
GRANT SELECT ON public.payout_requests_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_payout_rate_limit TO authenticated;

-- Add comment
COMMENT ON TABLE public.payout_requests_log IS 
  'Audit log of all payout requests for compliance, fraud detection, and rate limiting';

