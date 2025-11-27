# 🚀 Deploy Video Analytics - Quick Guide

**Date**: January 28, 2025

---

## ✅ What's Ready

1. **RPC Functions** - `supabase/migrations/20250128_create_video_analytics_rpcs.sql`
2. **Edge Function Updated** - `supabase/functions/track-analytics/index.ts` (uses RPCs)
3. **Tables Created** - `analytics.video_errors` and `analytics.video_metrics`

---

## 📋 Deploy Steps

### Step 1: Apply Database Migration
```bash
npx supabase db push
```

This will create:
- `public.insert_video_error()` RPC function
- `public.insert_video_metric()` RPC function

### Step 2: Deploy Edge Function
```bash
npx supabase functions deploy track-analytics
```

This deploys the updated function that uses RPC calls.

---

## ✅ Verify Deployment

### Check RPC Functions Exist
Run in Supabase SQL Editor:
```sql
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname IN ('insert_video_error', 'insert_video_metric')
ORDER BY proname;
```

Should return 2 rows.

### Test Video Analytics
1. Play a video in the app
2. Check browser console - should see no 400 errors
3. Check Supabase logs - should see successful inserts

### Query Test Data
```sql
-- Check video errors
SELECT COUNT(*) FROM analytics.video_errors;

-- Check video metrics  
SELECT COUNT(*) FROM analytics.video_metrics;

-- Recent errors
SELECT error_type, error_message, created_at 
FROM analytics.video_errors 
ORDER BY created_at DESC 
LIMIT 10;

-- Recent metrics
SELECT metric, value, created_at 
FROM analytics.video_metrics 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 🐛 Troubleshooting

### Still Getting 400 Errors?

1. **Check if RPC functions exist**:
   ```sql
   SELECT proname FROM pg_proc WHERE proname LIKE 'insert_video%';
   ```
   If empty, run: `npx supabase db push`

2. **Check Edge Function logs**:
   - Go to Supabase Dashboard → Edge Functions → track-analytics → Logs
   - Look for error messages

3. **Verify service role key**:
   - Edge Function needs `SUPABASE_SERVICE_ROLE_KEY` env var
   - Should be set automatically in Supabase

4. **Check IP address format**:
   - Edge Function now handles `'unknown'` IP by passing `null`
   - PostgreSQL will accept `null` for INET type

---

## 📝 Notes

- Chrome Cast errors are harmless (browser extension)
- Video analytics errors should stop after deployment
- Data will start populating in `analytics.video_errors` and `analytics.video_metrics` tables

---

**Status**: Ready to deploy ✅

