# ✅ Post-Deployment Verification Guide

## 🎉 Deployment Complete!

All 3 migrations have been successfully deployed:
- ✅ Data Retention Cron Job (Schedule ID: 23)
- ✅ Notification Preferences Table
- ✅ Push Notification Wiring

---

## 🔍 Verification Queries

Run these in Supabase SQL Editor to verify everything is working:

### 1. Verify Cron Job
```sql
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job 
WHERE jobname = 'data-retention-cleanup';
```

**Expected:** Should return 1 row with `active = true` and schedule matching `0 2 * * *` (daily at 2 AM UTC)

---

### 2. Verify Notification Preferences Table
```sql
-- Check table exists
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'notification_preferences'
ORDER BY ordinal_position;
```

**Expected:** Should show columns: `user_id`, `push_messages`, `push_tickets`, `push_social`, `push_marketing`, `updated_at`, `created_at`

---

### 3. Verify Push Notification Queue Table
```sql
-- Check table exists
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'push_notification_queue'
ORDER BY ordinal_position;
```

**Expected:** Should show columns: `id`, `notification_id`, `user_id`, `title`, `body`, `data`, `status`, `attempts`, `max_attempts`, `error_message`, `created_at`, `processed_at`

---

### 4. Verify Trigger Function
```sql
SELECT 
  tgname AS trigger_name,
  tgrelid::regclass AS table_name,
  tgenabled AS enabled,
  pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgname = 'on_notification_created_queue_push';
```

**Expected:** Should return 1 row showing the trigger is enabled on `public.notifications`

---

### 5. Verify Helper Functions
```sql
SELECT 
  routine_name,
  routine_type,
  data_type AS return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_notification_preferences',
    'trigger_data_retention_cleanup',
    'queue_push_notification',
    'send_push_for_notification'
  )
ORDER BY routine_name;
```

**Expected:** Should return 4 rows (all functions exist)

---

## 🧪 Test the System

### Test 1: Create a Test Notification Preference
```sql
-- Replace YOUR_USER_ID with an actual user ID
INSERT INTO public.notification_preferences (
  user_id,
  push_messages,
  push_tickets,
  push_social,
  push_marketing
) VALUES (
  'YOUR_USER_ID'::uuid,
  true,
  true,
  true,
  false
)
ON CONFLICT (user_id) DO UPDATE SET
  push_messages = EXCLUDED.push_messages,
  push_tickets = EXCLUDED.push_tickets,
  push_social = EXCLUDED.push_social,
  push_marketing = EXCLUDED.push_marketing,
  updated_at = now();

-- Verify it was created
SELECT * FROM public.notification_preferences WHERE user_id = 'YOUR_USER_ID'::uuid;
```

---

### Test 2: Test Push Notification Queue
```sql
-- Create a test notification (this should trigger the queue)
-- Replace YOUR_USER_ID with an actual user ID
INSERT INTO public.notifications (
  user_id,
  title,
  message,
  event_type,
  action_url,
  data
) VALUES (
  'YOUR_USER_ID'::uuid,
  'Test Notification',
  'This is a test notification to verify push queue',
  'post_like',
  '/events/test',
  '{"test": true}'::jsonb
);

-- Check if it was queued
SELECT 
  id,
  notification_id,
  user_id,
  title,
  status,
  attempts,
  created_at
FROM public.push_notification_queue
WHERE user_id = 'YOUR_USER_ID'::uuid
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** Should see a new row with `status = 'pending'`

---

### Test 3: Test Data Retention Cleanup (Manual Trigger)
```sql
-- Manually trigger the cleanup function
SELECT public.trigger_data_retention_cleanup();
```

**Expected:** Should return JSON with cleanup results (may be empty if no old data exists)

---

## 🚀 Next Steps

### 1. Configure OneSignal (If Not Done)
- Ensure `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY` are set in Supabase Edge Function secrets
- Test push notification delivery via `process-push-queue` Edge Function

### 2. Test Real Notification Flow
1. Have User A follow User B
2. Check if notification is created in `public.notifications`
3. Check if push notification is queued in `public.push_notification_queue`
4. Verify Edge Function processes the queue

### 3. Monitor Cron Job
- Check Supabase logs after 2 AM UTC to see if cron job runs
- Verify old analytics data is being cleaned up

### 4. Frontend Integration
- Users can now access notification preferences via Settings page
- Notification preferences UI is already implemented in `src/components/NotificationPreferences.tsx`

---

## 📊 Monitoring Queries

### Check Push Queue Status
```sql
SELECT 
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_time_seconds
FROM public.push_notification_queue
WHERE created_at > now() - interval '24 hours'
GROUP BY status;
```

### Check Notification Preferences Adoption
```sql
SELECT 
  COUNT(DISTINCT user_id) as users_with_preferences,
  COUNT(DISTINCT auth.users.id) as total_users,
  ROUND(100.0 * COUNT(DISTINCT user_id) / NULLIF(COUNT(DISTINCT auth.users.id), 0), 2) as adoption_percent
FROM public.notification_preferences
CROSS JOIN auth.users;
```

### Check Cron Job Execution History
```sql
SELECT 
  jobid,
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
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'data-retention-cleanup')
ORDER BY start_time DESC
LIMIT 10;
```

---

## ✅ Success Criteria

- [ ] Cron job exists and is active
- [ ] Notification preferences table is accessible
- [ ] Push notification queue table exists
- [ ] Trigger function is enabled
- [ ] Test notification creates queue entry
- [ ] Helper functions are callable
- [ ] RLS policies allow users to manage their own preferences

---

**Status:** ✅ All systems deployed and ready for testing!

