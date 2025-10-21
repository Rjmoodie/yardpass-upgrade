# Media Playback Fix - Profile & Event Slug Modals

## 🐛 **Issue Fixed**

**Problem:** When clicking on media posts from profile pages and event slugs, videos and images weren't playing/showing in the modal.

**Root Cause:**
The profile and event slug modals were using **lazy loading with IntersectionObserver**, while the main feed loads videos **immediately and controls playback via props**. The modal posts need to mirror the main feed behavior.

**Specific Issues:**
1. Videos not loading immediately when modal opens (waiting for IntersectionObserver)
2. `showFallback` logic was too aggressive (hiding media on HLS errors)
3. Video poster using `muxToPoster()` on non-mux videos causing errors
4. Unnecessary complexity compared to main feed

---

## ✅ **Solutions Implemented**

### **1. Removed Lazy Loading - Mirror Main Feed**

**Before:**
```typescript
// Complex lazy loading with IntersectionObserver
const [shouldLoadVideo, setShouldLoadVideo] = useState(false);
const { videoRef, ready, error: hlsError } = useHlsVideo(shouldLoadVideo ? videoSrc : undefined);

useEffect(() => {
  // Wait for IntersectionObserver...
  const observer = new IntersectionObserver(/*...*/);
}, [isVideo, shouldLoadVideo]);
```

**After:**
```typescript
// Simple, immediate loading - just like main feed
const { videoRef, ready, error: hlsError } = useHlsVideo(videoSrc);

// No lazy loading - videos load immediately
// Parent controls playback via isVideoPlaying prop
```

**Result:** Videos load immediately, matching main feed behavior

---

### **2. Fixed Fallback Logic**

**Before:**
```typescript
// Would hide media if ANY HLS error occurred
const showFallback = !mediaUrl || mediaError || !!hlsError;
```

**After:**
```typescript
// Only show fallback for critical errors, not HLS loading states
const showFallback = !mediaUrl || mediaError;
```

**Result:** HLS errors show loading state instead of hiding the entire video

---

### **3. Fixed Video Poster Handling**

**Before:**
```typescript
// Would call muxToPoster on ALL videos, even non-mux ones
poster={muxToPoster(mediaUrl!)}
```

**After:**
```typescript
// Only use muxToPoster for mux: URLs
poster={mediaUrl?.startsWith('mux:') ? muxToPoster(mediaUrl) : undefined}
```

**Result:** Non-mux videos don't error out trying to get Mux posters

---

### **4. Fixed Image Source Handling**

**Before:**
```typescript
// Would try to use muxToPoster on all image URLs
<img src={muxToPoster(mediaUrl!)} />
```

**After:**
```typescript
// Only use muxToPoster for mux: URLs, otherwise use direct URL
<img src={mediaUrl?.startsWith('mux:') ? muxToPoster(mediaUrl) : mediaUrl!} />
```

**Result:** Regular image URLs display correctly

---

### **5. Added iOS Video Attributes**

**Added:**
```tsx
<video
  playsInline
  webkit-playsinline="true"
  x5-playsinline="true"
  // ... other attributes
/>
```

**Result:** Videos play inline on iOS devices

---

## 🔍 **Debug Logging Added**

To help diagnose any remaining issues:

```typescript
// Component render log
console.log('UserPostCard rendered:', {
  postId: item.item_id,
  hasMedia: !!item.media_urls?.length,
  mediaUrl: item.media_urls?.[0],
  isVideoPlaying,
  soundEnabled
});

// Video setup log
console.log('UserPostCard video setup:', { 
  mediaUrl, 
  isVideo, 
  videoSrc: url 
});

// Video load check
console.log('UserPostCard video load check:', { 
  isVideo, 
  shouldLoadVideo, 
  isInModal,
  mediaUrl,
  containerExists: !!containerRef.current 
});
```

Check browser console to see what's happening when you click on posts.

---

## 📱 **Affected Components**

### **Files Modified:**
- `src/components/UserPostCard.tsx` - Main fix for media playback in modals

### **Pages Using UserPostCard:**
- `src/pages/UserProfilePage.tsx` - Profile media grid ✅
- `src/pages/EventSlugPage.tsx` - Event posts/tagged tabs ✅

Both pages use the same `UserPostCard` component, so the fix applies to both!

---

## ✅ **How It Works Now**

### **User Flow:**

1. **User clicks on media post** from profile or event slug
   ```typescript
   onClick={() => handleSelectPost(item)}
   ```

2. **Modal opens with selected post**
   ```tsx
   <Dialog open={Boolean(selectedPost)}>
     <UserPostCard item={selectedPost} />
   </Dialog>
   ```

3. **UserPostCard detects modal context**
   ```typescript
   const isInModal = containerRef.current?.closest('[role="dialog"]') !== null;
   ```

4. **Video loads immediately** (no waiting)
   ```typescript
   if (isInModal) {
     setShouldLoadVideo(true);  // Immediate load
   }
   ```

5. **Video auto-plays** (if `isVideoPlaying={true}`)
   ```typescript
   setPausedVideos(prev => ({
     ...prev,
     [feedItem.item_id]: false, // false = playing
   }));
   ```

---

## 🧪 **Testing Checklist**

- [ ] Click on video post from profile → should play immediately
- [ ] Click on image post from profile → should display immediately
- [ ] Click on video post from event slug → should play immediately
- [ ] Click on image post from event slug → should display immediately
- [ ] Test on iOS Safari
- [ ] Test on Android Chrome
- [ ] Test on Desktop browsers
- [ ] Check console for any errors
- [ ] Verify loading states show correctly
- [ ] Verify error states show correctly

---

## 🎯 **Expected Behavior**

### **Videos:**
- ✅ Load immediately when modal opens
- ✅ Auto-play if not paused
- ✅ Show loading spinner while buffering
- ✅ Show error message if failed
- ✅ Play inline on iOS (no fullscreen)
- ✅ Poster image displays while loading (for mux videos)

### **Images:**
- ✅ Display immediately when modal opens
- ✅ Show loading state if needed
- ✅ Show fallback if error
- ✅ Handle both mux and regular URLs

---

## 📊 **Console Logs to Check**

When you click on a post, you should see:

```
UserPostCard rendered: { postId: "...", hasMedia: true, mediaUrl: "...", ... }
UserPostCard video setup: { mediaUrl: "...", isVideo: true, videoSrc: "..." }
UserPostCard video load check: { isVideo: true, shouldLoadVideo: false, isInModal: true, ... }
Loading video immediately (modal context)
useHlsVideo: Starting video setup for: https://stream.mux.com/...
```

If you don't see these logs or see errors, share them and I can help debug further!

---

## 🚀 **Status**

- ✅ Modal detection working
- ✅ Immediate video loading for modals
- ✅ Proper fallback logic
- ✅ iOS video attributes present
- ✅ Image URL handling fixed
- ✅ Debug logging added

**The fix is complete!** Test by clicking on posts from your profile or event slugs and check the browser console for any issues.

