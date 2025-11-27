# 🔧 Fix Video Analytics RPC Functions

**Issue**: PostgREST can't find `public.insert_video_metric` and `public.insert_video_error` functions  
**Error**: `PGRST202: Could not find the function public.insert_video_metric(...) in the schema cache`  
**Cause**: PostgREST schema cache is stale (needs refresh after creating new functions)

---

## ✅ Solution: Apply Migration + Refresh Cache

### Step 1: Apply the Migration
```bash
npx supabase db push
```

This will:
- Create `public.insert_video_error()` function
- Create `public.insert_video_metric()` function
- Grant execute permissions to `service_role`
- **Send `NOTIFY pgrst, 'reload schema'` to refresh PostgREST cache**

### Step 2: Wait 30-60 seconds
PostgREST needs a moment to reload the schema cache after the NOTIFY command.

### Step 3: Verify Functions Exist
Run in Supabase SQL Editor:
```sql
SELECT 
  proname as function_name,
  pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc 
WHERE proname IN ('insert_video_error', 'insert_video_metric')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;
```

Should return 2 rows.

### Step 4: Test Video Analytics
1. Play a video in the app
2. Check browser console - should see **no 400 errors**
3. Check Supabase Edge Function logs - should see successful inserts

---

## 🐛 If Still Failing

### Option A: Force Cache Reload (Manual)
Run in Supabase SQL Editor:
```sql
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
```

Wait 30 seconds, then test again.

### Option B: Wait for Auto-Refresh
PostgREST automatically refreshes schema cache every **10 minutes**.

**Action**: Wait 5-10 minutes, then test again.

### Option C: Verify Migration Applied
Check if functions exist:
```sql
SELECT proname, pronamespace::regnamespace 
FROM pg_proc 
WHERE proname LIKE 'insert_video%';
```

If empty, the migration hasn't been applied. Run:
```bash
npx supabase db push
```

---

## 📊 Expected Behavior After Fix

### Before Fix:
```
❌ POST /functions/v1/track-analytics 400 (Bad Request)
❌ Error: Could not find the function public.insert_video_metric(...) in the schema cache
```

### After Fix:
```
✅ POST /functions/v1/track-analytics 200 (OK)
✅ Video metrics/errors successfully inserted
✅ No errors in console
```

---

## 🔍 Verify Data is Being Collected

After fix is applied and videos are played:

```sql
-- Check video errors
SELECT COUNT(*) as error_count FROM analytics.video_errors;

-- Check video metrics  
SELECT COUNT(*) as metric_count FROM analytics.video_metrics;

-- Recent errors
SELECT 
  error_type, 
  error_message, 
  playback_id,
  created_at 
FROM analytics.video_errors 
ORDER BY created_at DESC 
LIMIT 10;

-- Recent metrics
SELECT 
  metric, 
  value, 
  playback_id,
  created_at 
FROM analytics.video_metrics 
ORDER BY created_at DESC 
LIMIT 10;
```

---

**Status**: Migration updated with `NOTIFY pgrst, 'reload schema'` ✅  
**Next**: Run `npx supabase db push` to apply the fix

