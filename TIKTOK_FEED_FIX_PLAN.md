# TikTok-Style Feed Fix - Implementation Plan

## 🎯 Goal
Fix the video feed to achieve true TikTok-style behavior:
- One card per screen swipe
- Videos fill the entire visible area (above bottom nav)
- No extra scroll area at the bottom
- Smooth snap scrolling

---

## 📋 Current Issues

1. **Section Height Problem**
   - Sections are `100dvh` but bottom nav overlaps
   - Creates "extra scroll" feeling
   - Location: `FeedPageNewDesign.tsx` line 700

2. **Video Container Size Problem**
   - VideoMedia uses `aspect-[9/16] max-h-[82vh]`
   - Video doesn't fill the section height
   - Creates blank space below video
   - Location: `VideoMedia.tsx` line 296

3. **Overlay Cursor Behavior**
   - Always shows pointer cursor
   - Should show pointer when paused, default when playing
   - Location: `VideoMedia.tsx` line 300

---

## ✅ Solution Plan

### **Step 1: Update Section Height in FeedPageNewDesign**

**File:** `src/features/feed/routes/FeedPageNewDesign.tsx`  
**Line:** ~698-701

**Current:**
```tsx
style={{
  // ✅ Each section fills the viewport (snap scrolling)
  height: '100dvh',
  minHeight: '-webkit-fill-available',
}}
```

**Change to:**
```tsx
style={{
  // One item per screen, but leave room for bottom nav
  height: 'calc(100dvh - var(--bottom-nav-safe, 4.5rem))',
  minHeight: 'calc(100dvh - var(--bottom-nav-safe, 4.5rem))',
}}
```

**Why:** The CSS variable `--bottom-nav-safe` already exists in `src/index.css` (line 213). This makes each section exactly match the visible feed area above the bottom nav.

---

### **Step 2: Update VideoMedia Container**

**File:** `src/components/feed/VideoMedia.tsx`  
**Line:** ~294-298

**Current:**
```tsx
<div ref={containerRef}
  className={cn(
    "relative w-full overflow-hidden rounded-3xl bg-background aspect-[9/16] max-h-[82vh] shadow-xl",
    "group"
  )}
>
```

**Change to:**
```tsx
<div ref={containerRef}
  className={cn(
    "relative h-full w-full overflow-hidden bg-black rounded-3xl shadow-xl",
    "group"
  )}
>
```

**Why:** 
- Remove `aspect-[9/16]` and `max-h-[82vh]` constraints
- Use `h-full` to fill parent section
- Change `bg-background` to `bg-black` for better video appearance
- The MuxPlayer already has `height: "100%"` in its style, so it will fill the container

---

### **Step 3: Update Overlay Cursor Behavior**

**File:** `src/components/feed/VideoMedia.tsx`  
**Line:** ~300

**Current:**
```tsx
<div className="absolute inset-0 z-20 cursor-pointer" onClick={handleTogglePlayback} aria-hidden="true" />
```

**Change to:**
```tsx
<div 
  className={cn(
    "absolute inset-0 z-20",
    isPlaying ? "cursor-default" : "cursor-pointer"
  )}
  onClick={handleTogglePlayback}
  aria-hidden="true"
/>
```

**Why:** Better UX - shows pointer cursor when paused (indicating you can tap to play), default cursor when playing.

**Note:** Need to import `cn` if not already imported (check line 1-10).

---

### **Step 4: Verify Image Fallback (Already Correct)**

**File:** `src/components/feed/UserPostCardNewDesign.tsx`  
**Line:** ~175-180

**Current (already correct):**
```tsx
<ImageWithFallback
  src={mediaUrl}
  alt={item.content || 'Post'}
  className="h-full w-full object-cover"
/>
```

**Status:** ✅ No changes needed - already fills container correctly

---

### **Step 5: Verify Sentinel (Already Correct)**

**File:** `src/features/feed/routes/FeedPageNewDesign.tsx`  
**Line:** ~730-735

**Current (already correct):**
```tsx
<div
  ref={sentinelRef}
  className="h-px w-full opacity-0 pointer-events-none"
/>
```

**Status:** ✅ No changes needed - already invisible and doesn't add scroll height

---

## 🧪 Testing Checklist

After implementing changes, verify:

- [ ] Each swipe lands exactly on one item (no partial scroll)
- [ ] No extra scroll area at the bottom of the feed
- [ ] Videos fill the entire visible area (no blank space below)
- [ ] Images also fill the entire visible area
- [ ] Bottom nav doesn't overlap content
- [ ] Tap-to-pause/play works on video
- [ ] Cursor changes appropriately (pointer when paused, default when playing)
- [ ] Works on iPhone SE (smallest screen)
- [ ] Works on larger screens (iPad, desktop)
- [ ] Smooth scrolling with snap behavior

---

## 📝 Files to Modify

1. ✅ `src/features/feed/routes/FeedPageNewDesign.tsx` - Section height
2. ✅ `src/components/feed/VideoMedia.tsx` - Container size & cursor behavior

---

## 🎨 Expected Result

- **Before:** Sections are 100dvh, videos are ~82vh → extra scroll + blank space
- **After:** Sections are `calc(100dvh - bottomNav)`, videos are `h-full` → perfect TikTok-style snap, no extra scroll

---

## ⚠️ Notes

- The CSS variable `--bottom-nav-safe` is already defined in `src/index.css`
- UserPostCardNewDesign root structure is already correct (`relative h-full w-full`)
- Image fallback already uses `h-full w-full object-cover`
- Sentinel is already optimized (1px, invisible)

This is a minimal change that should fix the core issue without breaking existing functionality.

