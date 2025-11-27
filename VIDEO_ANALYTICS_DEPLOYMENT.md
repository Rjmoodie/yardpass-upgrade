# Video Analytics - Deployment Checklist

**Status**: ✅ Database migration complete

## ✅ Completed

- [x] Database tables created (`analytics.video_errors`, `analytics.video_metrics`)
- [x] Indexes created
- [x] RLS policies applied

## 🔄 Next Steps

### 1. Deploy Edge Function

```bash
supabase functions deploy track-analytics
```

Or via Dashboard:
1. Go to Edge Functions → `track-analytics`
2. Click "Deploy new version"
3. Wait for deployment to complete

### 2. Verify Tables

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'analytics' 
  AND table_name IN ('video_errors', 'video_metrics');

-- Should return:
-- video_errors
-- video_metrics
```

### 3. Test Analytics Calls

1. **Open your app** in browser
2. **Play a video** (or trigger an error intentionally)
3. **Check browser console** - should NOT see 400 errors anymore
4. **Check Network tab** - should see successful POSTs to `track-analytics`

### 4. Verify Data Insertion

```sql
-- Check for errors (might be empty initially)
SELECT * FROM analytics.video_errors ORDER BY created_at DESC LIMIT 10;

-- Check for metrics
SELECT * FROM analytics.video_metrics ORDER BY created_at DESC LIMIT 10;

-- Count total rows
SELECT 
  (SELECT COUNT(*) FROM analytics.video_errors) as error_count,
  (SELECT COUNT(*) FROM analytics.video_metrics) as metric_count;
```

### 5. Test Error Scenarios (Optional)

To verify error tracking works:
- Try playing a video with network throttling
- Try an invalid video URL
- Check that errors appear in the table

## 🎯 Success Indicators

✅ **Working correctly if:**
- No 400 errors in browser console
- Data appears in tables after video playback
- Edge Function deployment succeeds
- Queries return results

❌ **If issues occur:**
- Check Edge Function logs in Supabase Dashboard
- Verify RLS policies allow service_role inserts
- Check browser console for detailed error messages

## 📊 Once Data Starts Flowing

You can run these queries to verify:

```sql
-- Recent errors
SELECT 
  error_type,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM analytics.video_errors
GROUP BY error_type
ORDER BY count DESC;

-- Recent metrics summary
SELECT 
  metric,
  AVG(value) as avg_ms,
  COUNT(*) as sample_count
FROM analytics.video_metrics
GROUP BY metric;
```

---

**Ready for Edge Function deployment!** 🚀

