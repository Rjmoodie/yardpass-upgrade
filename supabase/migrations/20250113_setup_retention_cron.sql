-- ============================================================================
-- Migration: Setup Data Retention Cron Job
-- Purpose: Schedule automatic data retention cleanup
-- Author: AI Assistant
-- Date: 2025-01-13
-- Status: ⚠️ PENDING DEPLOYMENT - Deploy via Supabase Dashboard SQL Editor
-- Dependencies: Requires 20250113_create_data_retention_policy.sql (already deployed)
-- ============================================================================

-- Note: Supabase cron jobs are managed via pg_cron extension
-- This migration sets up the cron job to run daily at 2 AM UTC

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop existing cron job if it exists
SELECT cron.unschedule('data-retention-cleanup')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'data-retention-cleanup'
);

-- Schedule daily cleanup at 2 AM UTC
SELECT cron.schedule(
  'data-retention-cleanup',           -- Job name
  '0 2 * * *',                        -- Cron schedule: Daily at 2 AM UTC
  $$SELECT public.run_data_retention_cleanup()$$
);

COMMENT ON EXTENSION pg_cron IS 'Scheduled job for data retention cleanup runs daily at 2 AM UTC';

-- Optional: Create a function to manually trigger cleanup (for testing)
CREATE OR REPLACE FUNCTION public.trigger_data_retention_cleanup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.run_data_retention_cleanup();
END;
$$;

COMMENT ON FUNCTION public.trigger_data_retention_cleanup IS 'Manually trigger data retention cleanup (for testing/admin use)';

GRANT EXECUTE ON FUNCTION public.trigger_data_retention_cleanup() TO authenticated;

