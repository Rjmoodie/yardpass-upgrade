-- Phase 2.2.3: Push Notification Device Lifecycle Management
-- Adds status tracking and cleanup functions for device tokens

-- Add status column to user_devices for lifecycle management
ALTER TABLE public.user_devices 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' 
CHECK (status IN ('active', 'inactive', 'invalid'));

-- Add last_successful_send_at for tracking successful notifications
ALTER TABLE public.user_devices 
ADD COLUMN IF NOT EXISTS last_successful_send_at TIMESTAMPTZ;

-- Update existing records to have status = 'active' where active = true
UPDATE public.user_devices 
SET status = CASE 
  WHEN active = true THEN 'active'
  ELSE 'inactive'
END
WHERE status IS NULL;

-- Add index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_user_devices_status_updated 
ON public.user_devices(status, updated_at DESC) 
WHERE status IN ('inactive', 'invalid');

-- Add index for finding devices that need cleanup
CREATE INDEX IF NOT EXISTS idx_user_devices_cleanup_candidates 
ON public.user_devices(created_at DESC) 
WHERE status IN ('inactive', 'invalid');

-- Function to clean up old invalid/inactive devices
-- Strategy:
--   - Invalid devices: Remove after 90 days (these are broken, rejected by push service)
--   - Inactive devices: Remove after 180 days (old tokens, but user might come back to old device)
--     Only if user has an active token for the same platform (otherwise keep for re-engagement)
CREATE OR REPLACE FUNCTION public.cleanup_inactive_devices()
RETURNS TABLE(cleaned_count INTEGER, error_message TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invalid_cutoff_date TIMESTAMPTZ;
  inactive_cutoff_date TIMESTAMPTZ;
  deleted_count INTEGER;
BEGIN
  -- Invalid devices: Remove after 90 days (definitely broken)
  invalid_cutoff_date := NOW() - INTERVAL '90 days';
  
  -- Inactive devices: Remove after 180 days, but only if user has an active token
  inactive_cutoff_date := NOW() - INTERVAL '180 days';
  
  -- Delete old invalid devices (definitely broken)
  WITH deleted_invalid AS (
    DELETE FROM public.user_devices
    WHERE status = 'invalid'
      AND updated_at < invalid_cutoff_date
    RETURNING id
  ),
  -- Delete old inactive devices ONLY if user has an active token for the same platform
  deleted_inactive AS (
    DELETE FROM public.user_devices ud
    WHERE ud.status = 'inactive'
      AND ud.updated_at < inactive_cutoff_date
      AND EXISTS (
        -- User has an active token for the same platform
        SELECT 1 FROM public.user_devices active
        WHERE active.user_id = ud.user_id
          AND active.platform = ud.platform
          AND active.status = 'active'
          AND active.id != ud.id
      )
    RETURNING id
  )
  SELECT (
    (SELECT COUNT(*) FROM deleted_invalid) +
    (SELECT COUNT(*) FROM deleted_inactive)
  ) INTO deleted_count;
  
  RETURN QUERY SELECT deleted_count, NULL::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 0, SQLERRM::TEXT;
END;
$$;

COMMENT ON FUNCTION public.cleanup_inactive_devices IS 
  'Cleans up old device tokens: Invalid devices removed after 90 days. Inactive devices removed after 180 days only if user has an active token for the same platform (to preserve tokens for users who might return to old devices).';

-- Function to mark device as invalid (e.g., after failed notification sends)
CREATE OR REPLACE FUNCTION public.mark_device_invalid(
  p_device_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_devices
  SET 
    status = 'invalid',
    active = false,
    updated_at = NOW()
  WHERE id = p_device_id;
  
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.mark_device_invalid IS 
  'Marks a device token as invalid (e.g., after APNs reports invalid token). Used by notification senders.';

-- Function to update last successful send timestamp
CREATE OR REPLACE FUNCTION public.update_device_last_successful_send(
  p_device_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_devices
  SET 
    last_successful_send_at = NOW(),
    last_seen_at = NOW(), -- Also update last_seen since we know device is active
    status = 'active', -- Ensure it's marked as active if send succeeded
    active = true,
    updated_at = NOW()
  WHERE id = p_device_id;
  
  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION public.update_device_last_successful_send IS 
  'Updates the last_successful_send_at timestamp when a notification is successfully delivered. Used by notification senders.';

-- Grant execute permissions to service role (for cleanup jobs)
GRANT EXECUTE ON FUNCTION public.cleanup_inactive_devices() TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_device_invalid(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_device_last_successful_send(UUID) TO service_role;

-- Comments
COMMENT ON COLUMN public.user_devices.status IS 
  'Device lifecycle status: active (token valid and working), inactive (token no longer used but may be valid), invalid (token rejected by push service)';
  
COMMENT ON COLUMN public.user_devices.last_successful_send_at IS 
  'Timestamp of the last successful notification delivery to this device. Used to identify stale devices.';

