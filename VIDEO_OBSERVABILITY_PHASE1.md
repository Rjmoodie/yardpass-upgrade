# Video/HLS Observability - Phase 1 Complete

**Date**: January 28, 2025  
**Status**: ✅ Complete  
**Phase**: Production Observability

## 🎯 What We Accomplished

### 1. Created Video Logging Utility (`src/utils/videoLogger.ts`)

**Features:**
- ✅ Error tracking for all video failure types
- ✅ Performance metrics tracking (time to first frame, time to play)
- ✅ Automatic batching and sending to analytics
- ✅ Context-aware error reporting (user agent, network type, video state)
- ✅ Non-blocking (analytics failures don't break video playback)

**Error Types Tracked:**
- `load_error` - Video element load failures
- `playback_error` - General playback errors
- `hls_fatal_error` - HLS.js fatal errors
- `hls_network_error` - HLS.js network errors
- `hls_media_error` - HLS.js media errors
- `hls_init_error` - HLS.js initialization failures
- `autoplay_blocked` - Autoplay policy violations
- `timeout` - Playback timeouts
- `unknown` - Unclassified errors

**Metrics Tracked:**
- `time_to_first_frame` - Time from load start to metadata loaded
- `time_to_play` - Time from load start to playback start
- `buffering_duration` - Time spent buffering
- `playback_start_failed` - Failed playback attempts

### 2. Instrumented Video Components

#### `VideoMedia.tsx` (MuxPlayer)
- ✅ Error handler logs all playback errors
- ✅ Tracks time to first frame (onLoadedMetadata)
- ✅ Tracks time to play (onPlay)
- ✅ Logs autoplay blocked errors
- ✅ Includes post/event context in logs

#### `useHlsVideo.ts` (HLS.js Hook)
- ✅ Logs native iOS HLS errors
- ✅ Logs HLS.js fatal errors with error type and details
- ✅ Logs network errors with recovery attempts
- ✅ Logs media errors with recovery attempts
- ✅ Logs initialization failures
- ✅ Includes video element state in context

#### `useSmartHlsVideo.ts` (Smart HLS Hook)
- ✅ Logs HLS.js fatal errors
- ✅ Logs initialization failures
- ✅ Tracks error recovery attempts

### 3. Created Debug Page (`/dev/video-lab`)

**Features:**
- ✅ Real-time log viewer (errors, metrics, info)
- ✅ Video player with test videos
- ✅ Custom URL input for testing
- ✅ Visibility toggle (tests preloading behavior)
- ✅ Filter logs by type (All, Errors, Metrics)
- ✅ Video state information display
- ✅ Network type detection
- ✅ HLS.js support detection
- ✅ Native HLS support detection

**Access:**
- URL: `/dev/video-lab`
- Only available in development mode (`import.meta.env.DEV`)

## 📊 What Gets Logged

### Error Events
All errors are automatically:
1. Logged to console (for immediate visibility)
2. Sent to Supabase analytics (`track-analytics` Edge Function)
3. Buffered and batched (10 events or 5 seconds)
4. Include full context (playback ID, URL, video state, network info)

### Metric Events
Performance metrics are:
1. Logged in development if > 1000ms (slow operations)
2. Sent to Supabase analytics
3. Include context for correlation

## 🔍 How to Use

### View Logs in Production
1. Check Supabase analytics tables (via `track-analytics` function)
2. Check browser console (errors always logged)
3. Use debug page in development (`/dev/video-lab`)

### Test in Development
1. Navigate to `/dev/video-lab`
2. Select a test video or enter custom URL
3. Watch logs appear in real-time
4. Test different scenarios:
   - Autoplay blocking
   - Network errors
   - Invalid URLs
   - Visibility changes

## 📈 Next Steps (Phase 2)

Based on instrumentation findings, we'll:
1. Fix highest-impact issues (likely HLS cleanup or preloading)
2. Add retry logic for recoverable errors
3. Improve error messages for users
4. Optimize performance based on metrics

## 🧪 Baseline Metrics (To Be Collected)

Once deployed, we'll establish baselines for:
- Average time to first frame
- Average time to play
- Error rate by type
- HLS.js fatal error rate
- Autoplay block rate

## ✅ Files Created/Modified

**New Files:**
- `src/utils/videoLogger.ts` - Video logging utility
- `src/pages/dev/VideoLabPage.tsx` - Debug page

**Modified Files:**
- `src/components/feed/VideoMedia.tsx` - Added instrumentation
- `src/hooks/useHlsVideo.ts` - Added error tracking
- `src/hooks/useSmartHlsVideo.ts` - Added error tracking
- `src/App.tsx` - Added `/dev/video-lab` route

## 🎯 Success Criteria Met

- ✅ Video playback failure logging added
- ✅ HLS.js error tracking added
- ✅ Time to first frame tracking added
- ✅ Debug page created
- ✅ All errors include context (playback ID, network, video state)
- ✅ Non-blocking (doesn't affect video playback)
- ✅ Production-ready (batched, efficient)

---

**Ready for Phase 2**: Fix 1-2 highest-impact issues based on production data

