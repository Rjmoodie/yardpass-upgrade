# ⏰ Setup Cron Jobs for Phase 2.1

## 🎯 **Purpose**

These cron jobs automatically run the queue processors so emails and webhooks are processed continuously.

---

## 📋 **Prerequisites**

1. ✅ All Edge Functions deployed (DONE!)
2. ✅ Database migrations completed (DONE!)
3. ✅ Service Role Key (get from Supabase Dashboard → Settings → API)

---

## 🔧 **Setup Instructions**

### Step 1: Get Your Service Role Key

1. Go to: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/settings/api
2. Copy the **Service Role Key** (starts with `eyJ...`)
3. **Keep it secret!** This key has admin access.

---

### Step 2: Enable pg_cron Extension (If Not Already Enabled)

Run in Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

---

### Step 3: Set Up Email Queue Cron Job (Every 1 Minute)

Run in Supabase SQL Editor:

```sql
-- Replace YOUR_SERVICE_ROLE_KEY with your actual service role key
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *', -- Every minute (cron format)
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
```

**Expected output:** Should return `process-email-queue` indicating the job was scheduled.

---

### Step 4: Set Up Webhook Retry Cron Job (Every 5 Minutes)

Run in Supabase SQL Editor:

```sql
-- Replace YOUR_SERVICE_ROLE_KEY with your actual service role key
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
```

**Expected output:** Should return `process-webhook-retries` indicating the job was scheduled.

---

## ✅ **Verification**

### Check Cron Jobs Are Scheduled

```sql
-- View all scheduled cron jobs
SELECT * FROM cron.job;
```

You should see:
- `process-email-queue` with schedule `* * * * *`
- `process-webhook-retries` with schedule `*/5 * * * *`

### Check Cron Job History

```sql
-- View recent cron job runs
SELECT 
  jobid,
  jobname,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

---

## 🧪 **Test Manually**

Before waiting for cron, test manually:

### Test Email Queue Processor

```sql
SELECT
  net.http_post(
    url := 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
```

### Test Webhook Retry Processor

```sql
SELECT
  net.http_post(
    url := 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/process-webhook-retries',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
```

---

## 🔄 **Managing Cron Jobs**

### Unschedule a Job (If Needed)

```sql
SELECT cron.unschedule('process-email-queue');
SELECT cron.unschedule('process-webhook-retries');
```

### Update Schedule (If Needed)

First unschedule, then reschedule with new schedule:

```sql
-- Unschedule
SELECT cron.unschedule('process-email-queue');

-- Reschedule with new timing (e.g., every 2 minutes)
SELECT cron.schedule(
  'process-email-queue',
  '*/2 * * * *', -- Every 2 minutes
  $$...$$ -- same command as before
);
```

---

## 📊 **Monitor Queue Processing**

### Check Email Queue Status

```sql
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest_pending,
  MAX(created_at) as newest_pending
FROM email_queue
GROUP BY status;
```

### Check Webhook Retry Queue Status

```sql
SELECT 
  status,
  COUNT(*) as count,
  AVG(attempts) as avg_attempts,
  MIN(created_at) as oldest_pending
FROM webhook_retry_queue
GROUP BY status;
```

---

## ⚠️ **Important Notes**

1. **Service Role Key:** Must use Service Role Key (not anon key) for cron jobs
2. **Rate Limits:** Cron jobs respect the same rate limits as manual calls
3. **Monitoring:** Check cron job logs regularly for errors
4. **Cleanup:** Dead letter queue items need manual review

---

## 🎊 **Done!**

Once cron jobs are set up:
- ✅ Emails will be processed every minute
- ✅ Webhook retries will be processed every 5 minutes
- ✅ System will automatically retry failed operations

**Phase 2.1 is now fully operational!** 🚀

