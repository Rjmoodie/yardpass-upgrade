# Video Analytics - Testing Guide

**Status**: ✅ Tables created, ⏳ Waiting for Edge Function deployment

## Current Status

- ✅ Database tables created (`analytics.video_errors`, `analytics.video_metrics`)
- ✅ Migration successful
- ⏳ Edge Function needs deployment
- ⏳ No data yet (expected until function deployed)

## Next Steps

### 1. Deploy Edge Function

```bash
supabase functions deploy track-analytics
```

Or via Dashboard:
- Edge Functions → `track-analytics` → "Deploy new version"

### 2. Verify Tables Are Ready

```sql
-- Should return: video_errors, video_metrics
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'analytics' 
  AND table_name IN ('video_errors', 'video_metrics');

-- Check table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'analytics' 
  AND table_name = 'video_errors'
ORDER BY ordinal_position;

-- Should show 0 rows (normal - no data yet)
SELECT COUNT(*) FROM analytics.video_errors;
SELECT COUNT(*) FROM analytics.video_metrics;
```

### 3. Test Data Collection

**After deploying the Edge Function:**

1. **Open your app** in a browser
2. **Play a video** - any video will do
3. **Wait 5-10 seconds** for metrics to be tracked
4. **Check the tables:**

```sql
-- Should now show data!
SELECT * FROM analytics.video_metrics ORDER BY created_at DESC LIMIT 5;

-- Check for any errors (might be empty if everything works)
SELECT * FROM analytics.video_errors ORDER BY created_at DESC LIMIT 5;
```

### 4. Verify Analytics Calls

**Check browser console:**
- Should NOT see 400 errors
- Should see successful POSTs to `track-analytics` (in Network tab)

**Check Edge Function logs:**
- Should see successful inserts (no errors)
- In Supabase Dashboard → Edge Functions → track-analytics → Logs

## Expected Results

### After Deployment + Video Playback:

**video_metrics** should contain:
- `time_to_first_frame` entries
- `time_to_play` entries
- Values in milliseconds (e.g., 500, 1200, etc.)

**video_errors** might contain:
- Empty if no errors occur (good!)
- Or entries like `autoplay_blocked`, `playback_error`, etc.

### Sample Queries After Data Flows:

```sql
-- Recent metrics
SELECT 
  metric,
  AVG(value) as avg_ms,
  COUNT(*) as count
FROM analytics.video_metrics
WHERE created_at > now() - interval '1 hour'
GROUP BY metric;

-- Error breakdown
SELECT 
  error_type,
  COUNT(*) as count
FROM analytics.video_errors
WHERE created_at > now() - interval '1 hour'
GROUP BY error_type;
```

## Troubleshooting

**If tables are still empty after deployment:**

1. Check Edge Function logs for errors
2. Verify function was deployed successfully
3. Check browser console for analytics call failures
4. Try playing a video again and wait a moment

**If you see 400 errors:**

- Edge Function might not be deployed yet
- Check that the function has the new `video_error` and `video_metric` handlers
- Verify table names match (should be `video_errors`, `video_metrics`)

---

**Once Edge Function is deployed, data will start flowing automatically!** 🚀

