-- Fix check_stripe_idempotency function to return JSONB instead of TABLE
-- This fixes the 500 error in enhanced-checkout Edge Function

-- Drop the old function first (can't change return type with CREATE OR REPLACE)
DROP FUNCTION IF EXISTS public.check_stripe_idempotency(TEXT, TEXT);

-- Create the fixed function with JSONB return type
CREATE FUNCTION public.check_stripe_idempotency(
  p_operation_type TEXT,
  p_operation_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_record RECORD;
BEGIN
  SELECT 
    sik.stripe_resource_id,
    sik.stripe_idempotency_key,
    sik.created_at
  INTO v_record
  FROM public.stripe_idempotency_keys sik
  WHERE sik.operation_type = p_operation_type
    AND sik.operation_id = p_operation_id
    AND (sik.expires_at IS NULL OR sik.expires_at > NOW())
  LIMIT 1;
  
  -- If found, return the record as JSONB
  IF FOUND THEN
    RETURN jsonb_build_object(
      'is_completed', true,
      'stripe_resource_id', v_record.stripe_resource_id,
      'stripe_idempotency_key', v_record.stripe_idempotency_key,
      'created_at', v_record.created_at
    );
  END IF;
  
  -- If not found, return false
  RETURN jsonb_build_object(
    'is_completed', false,
    'stripe_resource_id', NULL,
    'stripe_idempotency_key', NULL,
    'created_at', NULL
  );
END;
$$;

COMMENT ON FUNCTION public.check_stripe_idempotency IS 
  'Checks if a Stripe operation has already been completed. Returns JSONB with is_completed boolean and Stripe resource ID if found.';

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION public.check_stripe_idempotency(TEXT, TEXT) TO service_role;

