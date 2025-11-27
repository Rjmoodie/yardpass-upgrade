# 🚀 Phase 2.1 Deployment Checklist

**Date:** January 28, 2025  
**Purpose:** Complete deployment guide for Phase 2.1 hardening features

---

## 📋 Prerequisites

Before deploying, ensure:
- [ ] Database backup completed
- [ ] Staging environment tested (if available)
- [ ] Supabase CLI installed and authenticated
- [ ] Access to Supabase Dashboard for cron job setup

---

## 🗄️ Database Migrations (Deploy First)

**Order matters!** Deploy in this sequence:

### 1. **Shared Primitives** (Required for rate limiting)
**File:** `supabase/migrations/20250128_create_shared_primitives.sql`

**What it creates:**
- `rate_limit_counters` table
- `increment_rate_limit()` function
- `cleanup_rate_limit_counters()` function

**Deploy command:**
```bash
supabase migration up 20250128_create_shared_primitives
```

**Or via Supabase Dashboard:**
- Go to Database → Migrations
- Upload `20250128_create_shared_primitives.sql`
- Run migration

---

### 2. **Email Queue** (Depends on shared primitives)
**File:** `supabase/migrations/20250128_create_email_queue.sql`

**What it creates:**
- `email_queue` table
- `calculate_email_retry_time()` function
- `get_email_queue_batch()` function
- `mark_email_sent()` function
- `mark_email_failed()` function
- RLS policies

**Deploy command:**
```bash
supabase migration up 20250128_create_email_queue
```

---

### 3. **Webhook Retry Queue** (Depends on shared primitives)
**File:** `supabase/migrations/20250128_create_webhook_retry_queue.sql`

**What it creates:**
- `webhook_retry_queue` table
- `calculate_webhook_retry_time()` function
- `get_webhook_retry_batch()` function
- `mark_webhook_processed()` function
- `mark_webhook_failed()` function
- RLS policies

**Deploy command:**
```bash
supabase migration up 20250128_create_webhook_retry_queue
```

---

## ⚡ Edge Functions (Deploy After Migrations)

### New Edge Functions

#### 1. **process-email-queue**
**Path:** `supabase/functions/process-email-queue/index.ts`

**Purpose:** Processes emails from `email_queue` table with rate limiting

**Deploy command:**
```bash
supabase functions deploy process-email-queue
```

**Environment Variables Required:**
- `RESEND_API_KEY` (already configured)
- `SUPABASE_URL` (auto-injected)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-injected)

---

#### 2. **process-webhook-retries**
**Path:** `supabase/functions/process-webhook-retries/index.ts`

**Purpose:** Processes failed webhooks from `webhook_retry_queue` table

**Deploy command:**
```bash
supabase functions deploy process-webhook-retries
```

**Environment Variables Required:**
- `STRIPE_SECRET_KEY` (already configured)
- `STRIPE_WEBHOOK_SECRET` (already configured)
- `SUPABASE_URL` (auto-injected)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-injected)

---

### Updated Edge Functions

#### 3. **send-email** (Updated)
**Path:** `supabase/functions/send-email/index.ts`

**Changes:**
- Now enqueues emails by default (`use_queue=true`)
- Falls back to direct send if queue fails
- Uses shared logger

**Deploy command:**
```bash
supabase functions deploy send-email
```

**No new environment variables required.**

---

#### 4. **stripe-webhook** (Updated)
**Path:** `supabase/functions/stripe-webhook/index.ts`

**Changes:**
- Enqueues failed webhooks for retry
- Returns 200 instead of 500 on errors (prevents Stripe retries)
- Uses shared queue utilities and logger

**Deploy command:**
```bash
supabase functions deploy stripe-webhook
```

**No new environment variables required.**

---

## ⏰ Cron Jobs Setup (After Deploying Functions)

Set up scheduled jobs in Supabase Dashboard:

### 1. **Email Queue Processor**
**Function:** `process-email-queue`  
**Schedule:** Every 1 minute  
**Method:** Via Supabase Dashboard → Database → Cron Jobs

```sql
-- Run via Supabase Dashboard SQL Editor or pg_cron extension
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-email-queue',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

**Or via Supabase Dashboard:**
- Go to Database → Cron Jobs
- Create new cron job:
  - **Name:** `process-email-queue`
  - **Schedule:** `* * * * *` (every minute)
  - **Command:** HTTP POST to `https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-email-queue`

---

### 2. **Webhook Retry Processor**
**Function:** `process-webhook-retries`  
**Schedule:** Every 5 minutes  
**Method:** Via Supabase Dashboard → Database → Cron Jobs

```sql
SELECT cron.schedule(
  'process-webhook-retries',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-webhook-retries',
    headers := '{"Authorization": "Bearer YOUR_ANON_KEY", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

**Or via Supabase Dashboard:**
- **Name:** `process-webhook-retries`
- **Schedule:** `*/5 * * * *` (every 5 minutes)
- **Command:** HTTP POST to `https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-webhook-retries`

---

### 3. **Rate Limit Counter Cleanup** (Optional)
**Function:** Database function (not Edge Function)  
**Schedule:** Daily

```sql
SELECT cron.schedule(
  'cleanup-rate-limit-counters',
  '0 2 * * *', -- Daily at 2 AM
  $$
  SELECT public.cleanup_rate_limit_counters();
  $$
);
```

---

## ✅ Verification Steps

After deployment, verify:

### 1. **Migrations**
```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('rate_limit_counters', 'email_queue', 'webhook_retry_queue');

-- Check if functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'increment_rate_limit',
    'calculate_email_retry_time',
    'get_email_queue_batch',
    'calculate_webhook_retry_time',
    'get_webhook_retry_batch'
  );
```

### 2. **Edge Functions**
- Test `process-email-queue`:
  ```bash
  curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-email-queue \
    -H "Authorization: Bearer YOUR_ANON_KEY" \
    -H "Content-Type: application/json"
  ```

- Test `process-webhook-retries`:
  ```bash
  curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-webhook-retries \
    -H "Authorization: Bearer YOUR_ANON_KEY" \
    -H "Content-Type: application/json"
  ```

### 3. **Email Queue**
- Send a test email via `send-email` function
- Check `email_queue` table for new entry
- Verify email is processed within 1 minute

### 4. **Webhook Retry Queue**
- Trigger a test webhook failure (or wait for natural failure)
- Check `webhook_retry_queue` table
- Verify retry processing within 5 minutes

---

## 📊 Monitoring (After Deployment)

### Key Metrics to Watch

1. **Email Queue:**
   ```sql
   SELECT 
     status,
     COUNT(*) as count,
     AVG(EXTRACT(EPOCH FROM (now() - created_at))) as avg_age_seconds
   FROM email_queue
   GROUP BY status;
   ```

2. **Webhook Retry Queue:**
   ```sql
   SELECT 
     status,
     COUNT(*) as count,
     AVG(attempts) as avg_attempts
   FROM webhook_retry_queue
   GROUP BY status;
   ```

3. **Dead Letter Queues:**
   ```sql
   -- Emails in dead letter
   SELECT COUNT(*) FROM email_queue WHERE status = 'dead_letter';
   
   -- Webhooks in dead letter
   SELECT COUNT(*) FROM webhook_retry_queue WHERE status = 'dead_letter';
   ```

4. **Rate Limit Counters:**
   ```sql
   SELECT 
     key,
     count,
     window_start,
     window_end
   FROM rate_limit_counters
   ORDER BY updated_at DESC
   LIMIT 10;
   ```

---

## 🔄 Rollback Plan

If issues occur:

### 1. **Disable Cron Jobs**
- Pause cron jobs in Supabase Dashboard
- Or remove via SQL:
  ```sql
  SELECT cron.unschedule('process-email-queue');
  SELECT cron.unschedule('process-webhook-retries');
  ```

### 2. **Revert Edge Functions**
- Redeploy previous versions of `send-email` and `stripe-webhook`
- Or temporarily disable new features via feature flags

### 3. **Keep Migrations**
- **DO NOT** rollback migrations (tables are safe, just unused if functions are disabled)
- Data in queues can be processed later

---

## 📝 Deployment Order Summary

1. ✅ **Migrate:** `20250128_create_shared_primitives.sql`
2. ✅ **Migrate:** `20250128_create_email_queue.sql`
3. ✅ **Migrate:** `20250128_create_webhook_retry_queue.sql`
4. ✅ **Deploy:** `process-email-queue` (new)
5. ✅ **Deploy:** `process-webhook-retries` (new)
6. ✅ **Deploy:** `send-email` (updated)
7. ✅ **Deploy:** `stripe-webhook` (updated)
8. ✅ **Setup:** Cron job for `process-email-queue` (every 1 min)
9. ✅ **Setup:** Cron job for `process-webhook-retries` (every 5 min)
10. ✅ **Verify:** Test email queue and webhook retry flow
11. ✅ **Monitor:** Watch queue sizes and success rates

---

## 🆘 Troubleshooting

### Issue: Edge Function can't find shared utilities
**Solution:** Ensure shared files are deployed:
```bash
# Shared files should be automatically included when deploying Edge Functions
# Verify structure:
ls supabase/functions/_shared/
```

### Issue: Cron job not running
**Solution:** Check pg_cron extension is enabled:
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
-- If not enabled:
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Issue: Rate limit function not found
**Solution:** Ensure migration ran successfully:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'increment_rate_limit';
```

---

**Ready to deploy! Follow the order above and verify each step before proceeding.**
