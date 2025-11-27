# Video Analytics Support - Implementation Complete

**Date**: January 28, 2025  
**Status**: ✅ Complete - Ready for Deployment

## 🎯 What Was Implemented

### 1. Database Tables Created ✅

**Migration**: `supabase/migrations/20250128_create_video_analytics_tables.sql`

#### `analytics.video_errors` Table
- Tracks video playback errors for debugging and monitoring
- Fields: error_type, playback_id, url, error_message, post_id, event_id, context (JSONB)
- Indexes on: post_id, event_id, error_type, created_at
- RLS enabled (service role insert, users can read own data)

#### `analytics.video_metrics` Table
- Tracks video performance metrics (load times, play times, etc.)
- Fields: metric, playback_id, url, value (ms), post_id, event_id, context (JSONB)
- Indexes on: post_id, event_id, metric, created_at
- RLS enabled (service role insert, users can read own data)

### 2. Edge Function Updated ✅

**File**: `supabase/functions/track-analytics/index.ts`

Added handlers for:
- `type === 'video_error'` → Inserts into `analytics.video_errors`
- `type === 'video_metric'` → Inserts into `analytics.video_metrics`

Both handlers:
- Extract context data (post_id, event_id, user info)
- Store full context as JSONB for flexibility
- Include IP address and user agent
- Return proper error responses if insertion fails

### 3. Video Logger Re-enabled ✅

**File**: `src/utils/videoLogger.ts`

- ✅ Re-enabled analytics calls for `logVideoError()` and `logVideoMetric()`
- ✅ Non-blocking (errors don't break video playback)
- ✅ Silent failures in production
- ✅ Debug logging in dev mode for troubleshooting

## 🚀 Deployment Steps

### Step 1: Run Database Migration

```bash
# Apply the migration
supabase db push
# OR via SQL Editor in Supabase Dashboard:
# Copy contents of supabase/migrations/20250128_create_video_analytics_tables.sql
```

### Step 2: Deploy Edge Function

```bash
# Deploy track-analytics function
supabase functions deploy track-analytics
# OR via Dashboard:
# Go to Edge Functions → track-analytics → Deploy new version
```

### Step 3: Verify Tables Created

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'analytics' 
  AND table_name IN ('video_errors', 'video_metrics');

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'analytics' 
  AND tablename IN ('video_errors', 'video_metrics');
```

### Step 4: Test Analytics Calls

1. Open app in browser
2. Play a video (or trigger an error)
3. Check console for analytics calls (should not show 400 errors)
4. Verify data in tables:

```sql
-- Check for errors
SELECT * FROM analytics.video_errors ORDER BY created_at DESC LIMIT 10;

-- Check for metrics
SELECT * FROM analytics.video_metrics ORDER BY created_at DESC LIMIT 10;
```

## 📊 What Gets Tracked

### Video Errors Tracked:
- `load_error` - Video element load failures
- `playback_error` - General playback errors
- `hls_fatal_error` - HLS.js fatal errors
- `hls_network_error` - HLS.js network errors
- `hls_media_error` - HLS.js media errors
- `hls_init_error` - HLS.js initialization failures
- `autoplay_blocked` - Autoplay policy violations
- `timeout` - Playback timeouts
- `unknown` - Unclassified errors

### Video Metrics Tracked:
- `time_to_first_frame` - Time from load start to metadata loaded (ms)
- `time_to_play` - Time from load start to playback start (ms)
- `buffering_duration` - Time spent buffering (ms)
- `playback_start_failed` - Failed playback attempts

### Context Stored (JSONB):
- User agent, network type
- Video element state (readyState, networkState)
- HLS error details (if applicable)
- Post ID, Event ID, User ID, Session ID

## 🔒 Privacy & Data Retention

**Important**: These tables store identifying information:
- `user_id`, `ip_address`, `user_agent`, `session_id`

**Recommendations**:
1. **Data Retention**: Implement a retention policy to purge data older than 90 days
   ```sql
   -- Example: Run monthly via cron or Edge Function
   DELETE FROM analytics.video_errors WHERE created_at < now() - interval '90 days';
   DELETE FROM analytics.video_metrics WHERE created_at < now() - interval '90 days';
   ```

2. **IP Anonymization** (optional): If full IP isn't needed, consider zeroing out the last octet:
   ```sql
   -- Example: 192.168.1.123 → 192.168.1.0
   ```

3. **RLS Access**: User-facing read access is optional. If not needed:
   ```sql
   REVOKE ALL ON analytics.video_errors FROM authenticated;
   REVOKE ALL ON analytics.video_metrics FROM authenticated;
   ```

## 🔍 Querying the Data

### Common Queries

```sql
-- Error rate by type (last 24 hours)
SELECT 
  error_type,
  COUNT(*) as count,
  COUNT(DISTINCT post_id) as affected_posts
FROM analytics.video_errors
WHERE created_at > now() - interval '24 hours'
GROUP BY error_type
ORDER BY count DESC;

-- Average load times by post
SELECT 
  post_id,
  AVG(value) as avg_time_to_play_ms,
  COUNT(*) as sample_count
FROM analytics.video_metrics
WHERE metric = 'time_to_play'
  AND created_at > now() - interval '7 days'
GROUP BY post_id
ORDER BY avg_time_to_play_ms DESC
LIMIT 20;

-- Error rate over time
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as error_count
FROM analytics.video_errors
WHERE created_at > now() - interval '7 days'
GROUP BY hour
ORDER BY hour DESC;

-- Slow video metrics (>2 seconds to play)
SELECT 
  post_id,
  playback_id,
  value as time_ms,
  context->>'network_type' as network_type
FROM analytics.video_metrics
WHERE metric = 'time_to_play'
  AND value > 2000
ORDER BY value DESC
LIMIT 50;

-- Top posts by error rate (last 24 hours)
SELECT
  post_id,
  COUNT(*) AS error_count
FROM analytics.video_errors
WHERE created_at > now() - interval '24 hours'
  AND post_id IS NOT NULL
GROUP BY post_id
ORDER BY error_count DESC
LIMIT 20;

-- Error breakdown by device type
SELECT
  context->>'device_type' AS device_type,
  error_type,
  COUNT(*) AS error_count
FROM analytics.video_errors
WHERE created_at > now() - interval '7 days'
  AND context->>'device_type' IS NOT NULL
GROUP BY device_type, error_type
ORDER BY error_count DESC;

-- Network type performance breakdown
SELECT
  context->>'network_type' AS network_type,
  metric,
  AVG(value) as avg_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value) as median_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value) as p95_ms,
  COUNT(*) as sample_count
FROM analytics.video_metrics
WHERE created_at > now() - interval '7 days'
  AND context->>'network_type' IS NOT NULL
GROUP BY network_type, metric
ORDER BY network_type, metric;
```

## 🎯 Next Steps (Optional Enhancements)

1. **Create Analytics Dashboard**
   - Error rate visualization
   - Performance metrics over time
   - Device/browser breakdown

2. **Add Alerts**
   - Alert when error rate exceeds threshold
   - Alert when load times degrade

3. **Aggregate Views**
   - Daily error summaries
   - Performance trends

4. **Future Optimizations** (when tables grow large):
   - Composite indexes: `(error_type, created_at)` and `(metric, created_at)`
   - GIN indexes on `context` JSONB if filtering on context fields
   - Convert to ENUM types for stricter validation (see migration comments)

5. **Rate Limiting** (if spam becomes an issue):
   - Client-side: Aggregate same errors before sending
   - Server-side: Rate limit per `session_id` or `user_id`

## ✅ Success Criteria

- [x] Database tables created with proper indexes
- [x] Edge Function handles video_error and video_metric types
- [x] Video logger sends data to analytics
- [x] Non-blocking (errors don't break video playback)
- [x] RLS policies in place
- [ ] Migration deployed (pending)
- [ ] Edge Function deployed (pending)
- [ ] Data verified in production (pending)

---

**Status**: Code complete, ready for deployment and testing! 🚀

