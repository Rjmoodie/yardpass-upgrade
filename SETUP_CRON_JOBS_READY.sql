-- ============================================================================
-- Phase 2.1: Cron Jobs Setup
-- ============================================================================
-- 
-- ⚠️ SECURITY: Replace YOUR_SERVICE_ROLE_KEY with your actual Service Role Key
-- Get it from: Supabase Dashboard > Settings > API > service_role key
-- NEVER commit this file with a real key!
--
-- ============================================================================

-- Step 1: Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- Step 2: Schedule Email Queue Processor (Every 1 Minute)
-- ============================================================================
-- 
-- ⚠️ REPLACE 'YOUR_SERVICE_ROLE_KEY' with your actual Service Role Key below
-- 

SELECT cron.schedule(
  'process-email-queue',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
      url := 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/process-email-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- Step 3: Schedule Webhook Retry Processor (Every 5 Minutes)
-- ============================================================================
-- 
-- ⚠️ REPLACE 'YOUR_SERVICE_ROLE_KEY' with your actual Service Role Key below
-- 

SELECT cron.schedule(
  'process-webhook-retries',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/process-webhook-retries',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- ============================================================================
-- Verification: Check if cron jobs are scheduled
-- ============================================================================

-- Check all cron jobs (should show your 2 new jobs)
SELECT 
  jobid,
  schedule,
  LEFT(command, 100) as command_preview,
  active
FROM cron.job
ORDER BY jobid DESC
LIMIT 10;

-- Or verify by looking for your function URLs in commands
SELECT 
  jobid,
  schedule,
  active,
  CASE 
    WHEN command LIKE '%process-email-queue%' THEN 'Email Queue Processor'
    WHEN command LIKE '%process-webhook-retries%' THEN 'Webhook Retry Processor'
    ELSE 'Other'
  END as job_type
FROM cron.job
WHERE command LIKE '%process-email-queue%' 
   OR command LIKE '%process-webhook-retries%';

-- ============================================================================
-- Optional: View cron job run history
-- ============================================================================

-- Run this after a few minutes to see if jobs are executing
-- Note: Join with cron.job to get job details
SELECT 
  d.jobid,
  d.status,
  LEFT(d.return_message, 100) as return_message_preview,
  d.start_time,
  d.end_time,
  CASE 
    WHEN j.command LIKE '%process-email-queue%' THEN 'Email Queue'
    WHEN j.command LIKE '%process-webhook-retries%' THEN 'Webhook Retry'
    ELSE 'Other'
  END as job_type
FROM cron.job_run_details d
JOIN cron.job j ON d.jobid = j.jobid
WHERE j.command LIKE '%process-email-queue%' 
   OR j.command LIKE '%process-webhook-retries%'
ORDER BY d.start_time DESC
LIMIT 10;

