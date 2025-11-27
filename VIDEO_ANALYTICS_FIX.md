# 🐛 Video Analytics Fix - RPC Functions

**Date**: January 28, 2025

---

## ❌ Problem

The Edge Function was getting 400 errors when trying to insert video analytics data because:
1. PostgREST doesn't expose the `analytics` schema directly via `.schema('analytics')`
2. The Supabase client can't access custom schemas without explicit configuration

---

## ✅ Solution

Created RPC functions that wrap the inserts, similar to how other custom schemas are accessed:

### 1. Created RPC Functions
**File**: `supabase/migrations/20250128_create_video_analytics_rpcs.sql`

- `public.insert_video_error()` - Inserts into `analytics.video_errors`
- `public.insert_video_metric()` - Inserts into `analytics.video_metrics`

Both functions:
- Use `SECURITY DEFINER` to bypass RLS
- Set `search_path = analytics, public` to access analytics schema
- Return the inserted row's UUID

### 2. Updated Edge Function
**File**: `supabase/functions/track-analytics/index.ts`

Changed from:
```typescript
// ❌ This doesn't work - analytics schema not exposed
await supabaseService
  .schema('analytics')
  .from('video_errors')
  .insert({...});
```

To:
```typescript
// ✅ This works - uses RPC function
await supabaseService
  .rpc('insert_video_error', {
    p_error_type: errorType,
    p_playback_id: data.playback_id || null,
    // ... other fields
  });
```

---

## 🚀 Deploy Steps

1. **Apply the migration**:
   ```bash
   npx supabase db push
   ```

2. **Deploy the updated Edge Function**:
   ```bash
   npx supabase functions deploy track-analytics
   ```

---

## ✅ Expected Result

After deployment:
- Video analytics inserts should work correctly
- No more 400 errors from `track-analytics` function
- Data will be properly stored in `analytics.video_errors` and `analytics.video_metrics` tables

---

## 📝 Notes

- RPC functions use `SECURITY DEFINER` which means they run with the privileges of the function creator (postgres), bypassing RLS
- This is safe because the functions validate input and only insert data (no reads)
- Service role can execute these functions, allowing Edge Functions to insert analytics data

