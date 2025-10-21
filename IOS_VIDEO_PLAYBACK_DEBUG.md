# iOS Video Playback Debugging Guide

## 🔍 **Diagnostic Logging Added**

I've added comprehensive console logging to diagnose why videos aren't playing on iOS in profile and event slug modals.

---

## 📊 **What to Check in iOS Safari Console**

### **When you click on a video post, you should see:**

### **1. Video Playback Effect Log:**
```
🎬 Video playback effect triggered: {
  postId: "xxx-xxx-xxx",
  isVideoPlaying: true/false,    ← Should be true when modal opens
  ready: true/false,              ← HLS ready state
  hlsError: null/error,           ← Should be null
  hasSrc: true/false,             ← Should be true
  readyState: 0-4,                ← 0=nothing, 4=ready
  muted: true/false               ← Should be true for autoplay
}
```

### **2. Playback Attempt Log:**
```
▶️ Attempting playback: {
  readyState: 1-4,                ← Should be >= 1
  readyStateLabel: "HAVE_METADATA",
  muted: true,                    ← MUST be true for iOS autoplay
  paused: true/false
}
```

### **3. Success or Error:**
```
✅ Video play successful: { postId: "...", readyState: 4 }
```
OR
```
⚠️ Video play prevented: {
  postId: "...",
  error: NotAllowedError,         ← iOS blocking autoplay
  muted: false,                   ← Problem: must be true!
  readyState: 1,
  hlsReady: true
}
```

---

## 🐛 **Common iOS Video Issues**

### **Issue 1: NotAllowedError**
**Symptom:** `⚠️ Video play prevented: { error: NotAllowedError }`

**Cause:** iOS blocking autoplay

**Solutions:**
- ✅ Ensure video is muted (`el.muted = true`)
- ✅ Ensure `muted` attribute in HTML
- ✅ Ensure user gesture triggered the modal open

**Check:**
```javascript
// Should see: muted: true
console.log('Video muted?', videoRef.current?.muted);
```

---

### **Issue 2: Video Not Ready**
**Symptom:** `readyState: 0` or `readyState: 1`

**Cause:** Video source not loaded yet

**Solutions:**
- ✅ Wait for `canplay` or `loadeddata` events (already implemented)
- ✅ Check if HLS source is valid

**Check:**
```javascript
// Should see valid URL
console.log('Video src:', videoRef.current?.src);
```

---

### **Issue 3: HLS Error**
**Symptom:** `hlsError: "some error"`

**Cause:** HLS.js or native HLS failing

**Solutions:**
- ✅ Check network requests for .m3u8 manifest
- ✅ Verify Mux playback ID is valid
- ✅ Check CORS headers

**Check:**
```javascript
// Should be null
console.log('HLS error?', hlsError);
```

---

### **Issue 4: isVideoPlaying is False**
**Symptom:** `isVideoPlaying: false` when modal opens

**Cause:** Parent not setting video to play state

**Check in UserProfilePage.tsx or EventSlugPage.tsx:**
```typescript
const handleSelectPost = (post: FeedItem) => {
  setSelectedPost(post);
  // ✅ This should set to false (playing)
  setPausedVideos(prev => ({
    ...prev,
    [post.item_id]: false, // false = video will play
  }));
};
```

**Then in modal:**
```tsx
<UserPostCard
  isVideoPlaying={!pausedVideos[selectedPost.item_id]}  // Should be true
/>
```

---

## 🔧 **Quick Fixes to Try**

### **Fix 1: Ensure Modal Opens with User Gesture**

iOS requires autoplay to be triggered by user interaction. Make sure:
```typescript
// ✅ User clicks thumbnail
onClick={() => handleSelectPost(item)}

// ✅ Modal opens (same event loop = counts as user gesture)
<Dialog open={Boolean(selectedPost)}>
```

### **Fix 2: Force Muted on iOS**

In `useHlsVideo.ts`, ensure muted is set:
```typescript
if (isIOS) {
  v.muted = true;
  v.setAttribute('muted', '');
}
```

### **Fix 3: Try Play on Next Tick**

Sometimes iOS needs a frame delay:
```typescript
const attemptPlayback = () => {
  requestAnimationFrame(() => {
    el.play().catch(console.error);
  });
};
```

---

## 📱 **iOS-Specific Video Requirements**

For videos to autoplay on iOS, ALL of these must be true:

1. ✅ Video is muted (`muted` attribute + `el.muted = true`)
2. ✅ Video has `playsInline` attribute
3. ✅ Video has `webkit-playsinline` attribute
4. ✅ Play triggered within user gesture event
5. ✅ Video src is loaded and ready
6. ✅ No network errors

**We have all of these!** But check the console logs to see which one is failing.

---

## 🧪 **Testing Steps**

### **On iOS Safari:**

1. Open Safari Developer Tools (Settings → Safari → Advanced → Web Inspector)
2. Navigate to profile or event slug page
3. Click on a video thumbnail
4. Watch console for logs
5. Share the console output

### **What to Look For:**

```
// Good 👍
🎬 Video playback effect triggered: { isVideoPlaying: true, ready: true, hasSrc: true, muted: true }
▶️ Attempting playback: { readyState: 4, muted: true }
✅ Video play successful

// Bad 👎
🎬 Video playback effect triggered: { isVideoPlaying: false, ... }  ← Not set to play!
OR
⚠️ Video play prevented: { error: NotAllowedError, muted: false }  ← Not muted!
OR
🎬 Video playback effect triggered: { ready: false, hasSrc: false }  ← Not loaded!
```

---

## 💡 **Expected Console Output (Working)**

```
🎬 Video playback effect triggered: {
  postId: "abc-123",
  isVideoPlaying: true,
  ready: true,
  hlsError: null,
  hasSrc: true,
  readyState: 1,
  muted: true
}
▶️ Attempting playback: {
  readyState: 1,
  readyStateLabel: "HAVE_METADATA",
  muted: true,
  paused: true
}
✅ Video play successful: {
  postId: "abc-123",
  readyState: 4,
  readyStateLabel: "HAVE_ENOUGH_DATA"
}
```

---

## 🎯 **Next Steps**

1. **Test on iOS** and check console logs
2. **Share the console output** if videos still don't play
3. Look for any of these in the logs:
   - `isVideoPlaying: false` → Parent not setting play state
   - `muted: false` → Muted state not syncing
   - `hasSrc: false` → Video source not loading
   - `NotAllowedError` → iOS autoplay blocking
   - `hlsError: ...` → HLS loading error

**The logging will tell us exactly what's wrong!** 🔍

