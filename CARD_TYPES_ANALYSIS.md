# Card Types Analysis - TikTok Feed Fix

## 📋 Card Types in Feed

The feed renders **2 main card types**:

### 1. **UserPostCardNewDesign** (Posts)
- **Type:** `item.item_type === 'post'`
- **Location:** `src/components/feed/UserPostCardNewDesign.tsx`
- **Contains:**
  - Videos (via `VideoMedia` component)
  - Images (via `ImageWithFallback`)
  - Text posts
  - Event associations

### 2. **EventCardNewDesign** (Events)
- **Type:** `item.item_type === 'event'`
- **Location:** `src/components/feed/EventCardNewDesign.tsx`
- **Contains:**
  - Event cover images
  - Event details (title, date, location)
  - Ticket purchase buttons

---

## ✅ Status Check

### **Section Height Fix** (FeedPageNewDesign.tsx)
**Status:** ✅ **APPLIES TO BOTH CARD TYPES**

Both cards are wrapped in the same `<section>` element that now uses:
```tsx
style={{
  height: 'calc(100dvh - var(--bottom-nav-safe, 4.5rem))',
  minHeight: 'calc(100dvh - var(--bottom-nav-safe, 4.5rem))',
}}
```

**Location:** Line 698-702 in `FeedPageNewDesign.tsx`

---

### **UserPostCardNewDesign** Structure
**Status:** ✅ **CORRECTLY STRUCTURED**

```tsx
// Root container
<div className="relative h-full w-full">
  {/* Full Screen Media Background */}
  <div className="absolute inset-0">
    {isVideo && mediaUrl ? (
      <VideoMedia ... />  // ✅ Now uses h-full w-full
    ) : mediaUrl ? (
      <ImageWithFallback
        className="h-full w-full object-cover"  // ✅ Already correct
      />
    ) : (
      <div className="h-full w-full bg-gradient..." />  // ✅ Already correct
    )}
  </div>
  {/* Info card positioned above nav */}
</div>
```

**Key Points:**
- ✅ Root: `h-full w-full` - fills section
- ✅ VideoMedia: Now uses `h-full w-full` (after fix)
- ✅ Image fallback: Already uses `h-full w-full object-cover`
- ✅ Info card: Positioned with `calc(var(--bottom-nav-safe) + 0.5rem)`

---

### **EventCardNewDesign** Structure
**Status:** ✅ **CORRECTLY STRUCTURED**

```tsx
// Root container
<div className="relative h-full w-full">
  {/* Full Screen Background Image */}
  <div className="absolute inset-0">
    <ImageWithFallback
      src={item.event_cover_image || DEFAULT_EVENT_COVER}
      alt={item.event_title || "Event"}
      className="h-full w-full object-cover"  // ✅ Already correct
    />
    {/* Gradient overlay */}
  </div>
  {/* Bottom Info Card - positioned above navigation bar */}
  <div style={{
    bottom: 'calc(var(--bottom-nav-safe, 4.5rem) + 0.5rem)'
  }}>
    {/* Event details card */}
  </div>
</div>
```

**Key Points:**
- ✅ Root: `h-full w-full` - fills section
- ✅ Image: Already uses `h-full w-full object-cover`
- ✅ Info card: Positioned with `calc(var(--bottom-nav-safe) + 0.5rem)`

---

## 🎯 Summary

| Card Type | Section Height Fix | Root Container | Media/Image | Info Card Position |
|-----------|-------------------|----------------|-------------|-------------------|
| **UserPostCardNewDesign** | ✅ Applied | ✅ `h-full w-full` | ✅ `h-full w-full` | ✅ Above nav |
| **EventCardNewDesign** | ✅ Applied | ✅ `h-full w-full` | ✅ `h-full w-full` | ✅ Above nav |

---

## ✅ Conclusion

**Both card types are correctly factored in:**

1. **Section height fix** applies to both (they share the same `<section>` wrapper)
2. **UserPostCardNewDesign** - VideoMedia now fills section after fix
3. **EventCardNewDesign** - Already correctly structured, no changes needed
4. **Both cards** use `h-full w-full` on root containers
5. **Both cards** position info cards above bottom nav consistently

**No additional changes needed for EventCardNewDesign** - it was already structured correctly!

---

## 🔍 Additional Notes

- Both cards use the same section wrapper, so the height fix benefits both
- EventCardNewDesign doesn't use VideoMedia, so it wasn't affected by that change
- Both cards use ImageWithFallback with the same `h-full w-full object-cover` pattern
- Both cards position their info cards using the same `--bottom-nav-safe` calculation

