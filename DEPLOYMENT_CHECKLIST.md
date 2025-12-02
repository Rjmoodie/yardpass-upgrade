# 🚀 Supabase Migration Deployment Checklist

## ✅ Already Deployed

- ✅ `20250111_add_age_verification.sql` - Age verification & region tracking
- ✅ `20250113_create_data_retention_policy.sql` - Data retention tables & functions
- ✅ `20250113_setup_retention_cron.sql` - Data retention cron job (Schedule ID: 23)
- ✅ `20250114_create_notification_preferences.sql` - Notification preferences table
- ✅ `20250114_wire_notifications_to_push.sql` - Push notification wiring

### 1. **Data Retention Cron Job**
**File:** `supabase/migrations/20250113_setup_retention_cron.sql`
- **Purpose:** Sets up daily cron job to run data retention cleanup at 2 AM UTC
- **Dependencies:** Requires `20250113_create_data_retention_policy.sql` (already deployed)
- **What it does:**
  - Enables `pg_cron` extension
  - Schedules daily cleanup job
  - Creates manual trigger function for testing

**Deploy via Supabase Dashboard SQL Editor:**
```sql
-- Copy entire contents of: supabase/migrations/20250113_setup_retention_cron.sql
```

---

### 2. **Notification Preferences Table**
**File:** `supabase/migrations/20250114_create_notification_preferences.sql`
- **Purpose:** Creates table for user notification preferences (push settings)
- **Dependencies:** None (standalone)
- **What it does:**
  - Creates `public.notification_preferences` table
  - Sets up RLS policies
  - Creates helper function `get_notification_preferences()`

**Deploy via Supabase Dashboard SQL Editor:**
```sql
-- Copy entire contents of: supabase/migrations/20250114_create_notification_preferences.sql
```

---

### 3. **Wire Notifications to Push System**
**File:** `supabase/migrations/20250114_wire_notifications_to_push.sql`
- **Purpose:** Automatically queues push notifications when in-app notifications are created
- **Dependencies:** Requires `20250114_create_notification_preferences.sql` (deploy #2 first)
- **What it does:**
  - Creates trigger function to queue push notifications
  - Creates `push_notification_queue` table for reliable processing
  - Wires trigger to `public.notifications` table

**Deploy via Supabase Dashboard SQL Editor:**
```sql
-- Copy entire contents of: supabase/migrations/20250114_wire_notifications_to_push.sql
```

---

## 📝 Deployment Instructions

### Option 1: Supabase Dashboard (Recommended)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/sql/new)
2. Open SQL Editor
3. Copy and paste each migration file content in order (1 → 2 → 3)
4. Run each migration separately
5. Verify success in each case

### Option 2: Supabase CLI (If you sync migrations first)
```bash
# Sync remote migrations to local
supabase db pull

# Then push new migrations
supabase db push
```

---

## ✅ Edge Functions Status

All Edge Functions are **already deployed**:
- ✅ `health-check` - Health monitoring endpoint
- ✅ `guest-checkout` - Guest checkout with security fix
- ✅ `cleanup-old-data` - Manual data retention cleanup trigger
- ✅ `process-push-queue` - Process push notification queue

---

## 🎯 Deployment Order

**IMPORTANT:** Deploy migrations in this exact order:

1. **First:** `20250113_setup_retention_cron.sql`
2. **Second:** `20250114_create_notification_preferences.sql`
3. **Third:** `20250114_wire_notifications_to_push.sql`

---

## 🔍 Verification Steps

After deploying all 3 migrations:

1. **Verify cron job:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'data-retention-cleanup';
   ```

2. **Verify notification preferences table:**
   ```sql
   SELECT * FROM public.notification_preferences LIMIT 1;
   ```

3. **Verify push queue table:**
   ```sql
   SELECT * FROM public.push_notification_queue LIMIT 1;
   ```

4. **Verify trigger exists:**
   ```sql
   SELECT * FROM pg_trigger WHERE tgname = 'on_notification_created_queue_push';
   ```

---

## 📌 Notes

- All migrations are **idempotent** (safe to re-run)
- Migrations use `CREATE OR REPLACE` and `IF NOT EXISTS` patterns
- RLS policies are properly configured
- Functions use `SECURITY DEFINER` with `SET search_path` for security

---

**Last Updated:** 2025-01-14
**Status:** ✅ All migrations deployed successfully!
