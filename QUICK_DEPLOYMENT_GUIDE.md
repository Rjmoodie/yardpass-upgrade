# ⚡ Quick Deployment Guide - Phase 2.1

**IMPORTANT:** Migrations and Edge Functions are deployed separately!

---

## 📍 What Goes Where

### 🗄️ SQL Migrations (Run in SQL Editor)
**Location:** `supabase/migrations/*.sql`  
**Tool:** Supabase Dashboard → SQL Editor OR Supabase CLI

### ⚡ Edge Functions (Deploy via CLI)
**Location:** `supabase/functions/*/index.ts`  
**Tool:** Supabase CLI `supabase functions deploy`

---

## ✅ Step-by-Step Deployment

### STEP 1: Deploy SQL Migrations

**Option A: Via Supabase Dashboard (Recommended)**

1. Go to: **Supabase Dashboard** → **SQL Editor**
2. Copy and paste each migration file **one at a time** in this order:

#### Migration 1: Shared Primitives
- **File:** `supabase/migrations/20250128_create_shared_primitives.sql`
- **Action:** Copy entire contents → Paste in SQL Editor → Run
- **Verify:** Check for "Success" message

#### Migration 2: Email Queue
- **File:** `supabase/migrations/20250128_create_email_queue.sql`
- **Action:** Copy entire contents → Paste in SQL Editor → Run
- **Verify:** Check for "Success" message

#### Migration 3: Webhook Retry Queue
- **File:** `supabase/migrations/20250128_create_webhook_retry_queue.sql`
- **Action:** Copy entire contents → Paste in SQL Editor → Run
- **Verify:** Check for "Success" message

**Option B: Via Supabase CLI**

```bash
# Make sure you're in the project root
cd "C:\Users\Louis Cid\Yardpass 3.0\yardpass-upgrade"

# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

---

### STEP 2: Deploy Edge Functions

**Only after migrations are complete!**

Open PowerShell/Terminal and run:

```bash
# Navigate to project root
cd "C:\Users\Louis Cid\Yardpass 3.0\yardpass-upgrade"

# Deploy new Edge Functions
supabase functions deploy process-email-queue
supabase functions deploy process-webhook-retries

# Deploy updated Edge Functions
supabase functions deploy send-email
supabase functions deploy stripe-webhook
```

**Verify deployment:**
- Check Supabase Dashboard → Edge Functions
- All 4 functions should show as "Active"

---

### STEP 3: Set Up Cron Jobs (After Functions Deploy)

**Go to:** Supabase Dashboard → **Database** → **Cron Jobs** (or SQL Editor)

#### Cron Job 1: Email Queue Processor

**In SQL Editor, run:**
```sql
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Replace `YOUR_PROJECT_ID`** with your actual Supabase project ID.

#### Cron Job 2: Webhook Retry Processor

```sql
SELECT cron.schedule(
  'process-webhook-retries',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/process-webhook-retries',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

---

## 🔍 Troubleshooting Your Error

**Error:** `syntax error at or near "{"` with `import { serve }`

**Cause:** You're trying to run an Edge Function TypeScript file as SQL.

**Solution:**
1. ✅ **Only run `.sql` files** in the SQL Editor
2. ✅ **Deploy `.ts` files** using `supabase functions deploy`
3. ❌ **DO NOT** paste TypeScript code into SQL Editor

---

## 📋 Verification Checklist

After deployment, verify:

```sql
-- 1. Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('rate_limit_counters', 'email_queue', 'webhook_retry_queue');

-- 2. Check functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name LIKE '%email%' OR routine_name LIKE '%webhook%';

-- 3. Check cron jobs
SELECT * FROM cron.job WHERE jobname IN ('process-email-queue', 'process-webhook-retries');
```

---

## 🚨 If You See the Import Error

**You're running the wrong file!**

- ❌ **Wrong:** Running `supabase/functions/process-email-queue/index.ts` in SQL Editor
- ✅ **Right:** Running `supabase/migrations/20250128_create_email_queue.sql` in SQL Editor

**Edge Functions (.ts files) should NEVER be run as SQL!**

---

## 📞 Quick Reference

| File Type | Location | How to Deploy |
|-----------|----------|---------------|
| **SQL Migration** | `supabase/migrations/*.sql` | SQL Editor or `supabase db push` |
| **Edge Function** | `supabase/functions/*/index.ts` | `supabase functions deploy` |

---

**Need help?** Make sure you're:
1. ✅ Running `.sql` files in SQL Editor (not `.ts` files)
2. ✅ Deploying Edge Functions via CLI
3. ✅ Following the order: Migrations first, then Functions, then Cron Jobs

