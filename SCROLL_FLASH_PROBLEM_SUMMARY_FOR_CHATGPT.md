# Scroll Flash Problem - Summary for ChatGPT

## 🎯 Problem Description

When navigating to the profile page (or other routes), there's a "flash then revert" behavior where:
1. The page header briefly appears at the top
2. Then the page automatically scrolls down, hiding the header
3. This creates a jarring UX where users see the header flash then disappear

**Root Cause:** Browser/React Router is restoring the previous scroll position after route navigation, causing the scroll container to jump to a saved position instead of starting at the top.

## 🔍 Technical Context

- **Framework:** React with React Router v6
- **Scroll Container:** `<main id="main-content">` element with `overflow-y-auto`
- **Layout:** Uses `FullScreenSafeArea` component for safe area handling
- **Issue:** Scroll restoration happens AFTER component render, overriding our reset attempts

## 📁 Files to Address

### Primary Files (Most Important)

1. **`src/App.tsx`**
   - Contains `ScrollRestorationManager` component (lines 31-207)
   - Contains `AppContent` component with scroll reset logic (lines 452-495)
   - Currently uses `useLayoutEffect` for scroll reset (line 454)
   - Main scroll container: `<main id="main-content">` (line 651)

2. **`src/pages/new-design/ProfilePage.tsx`**
   - The profile page component that experiences the flash
   - Uses `FullScreenSafeArea` with `scroll={false}` (line ~183)
   - Has its own scroll reset logic (removed, but may need review)

3. **`src/components/layout/FullScreenSafeArea.tsx`**
   - Layout component that handles safe areas
   - Has `scroll` prop that controls whether it's a scroll container
   - Contains scroll reset logic (lines 79-115)

4. **`src/main.tsx`**
   - Entry point
   - Sets `window.history.scrollRestoration = 'manual'` (line 77)

### Supporting Files

5. **`src/index.css`**
   - Contains CSS for scroll locking (`.scroll-locked`, `.scroll-resetting`)
   - Lines 8-20 (scroll lock styles)

6. **`src/App.tsx` - Routes Component**
   - `<Routes key={location.pathname}>` (line 698)
   - Forces remount on route change

## 🔧 Current Implementation Attempts

### Attempt 1: ScrollRestorationManager Component
- Location: `src/App.tsx` lines 31-207
- Strategy: Locks scrolling during route transitions
- Uses CSS classes to prevent scroll
- Unlocks after 800ms or when content is ready

### Attempt 2: AppContent useLayoutEffect
- Location: `src/App.tsx` lines 452-495
- Strategy: Resets scroll before browser paint
- Uses `useLayoutEffect` to run synchronously
- Multiple reset attempts with different timings

### Attempt 3: FullScreenSafeArea Scroll Reset
- Location: `src/components/layout/FullScreenSafeArea.tsx` lines 79-115
- Strategy: Resets scroll when route changes
- Uses both `useLayoutEffect` and `useEffect`

## 🚨 What's NOT Working

Despite all attempts:
- Scroll still restores after route change
- Header still flashes then scrolls away
- Multiple reset attempts don't prevent the restoration
- Scroll lock doesn't prevent the initial flash

## 🎯 What We Need

A solution that:
1. ✅ Prevents scroll restoration on route change
2. ✅ Ensures pages always start at scroll position 0
3. ✅ Works consistently across all routes
4. ✅ Doesn't cause performance issues
5. ✅ Doesn't interfere with user-initiated scrolling

## 🔍 Key Questions to Investigate

1. **Is React Router doing scroll restoration?** Check if React Router v6 has built-in scroll restoration that needs to be disabled.

2. **What's the actual scroll container?** Is it `#main-content`, `window`, `document.body`, or something else?

3. **When exactly is scroll being restored?** Is it:
   - Before our `useLayoutEffect` runs?
   - After our reset but before paint?
   - After paint but before user interaction?
   - From browser's scroll restoration cache?

4. **Are there layout shifts?** Do images or async content cause layout shifts that trigger scroll?

5. **Is there a React Router ScrollRestoration component?** Some versions have a `<ScrollRestoration>` component that needs configuration.

## 📝 Code Snippets to Review

### Main Scroll Container
```tsx
// src/App.tsx line 651
<main
  id="main-content"
  ref={mainContentRef}
  className="content-on-nav scroll-container flex-1 overflow-y-auto pb-nav"
  role="main"
>
```

### Scroll Reset in AppContent
```tsx
// src/App.tsx lines 452-495
useLayoutEffect(() => {
  const resetScroll = () => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
      mainContentRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    // ... reset all scroll containers
  };
  resetScroll();
  // ... multiple reset attempts
}, [location.pathname]);
```

### Browser Scroll Restoration Disabled
```tsx
// src/main.tsx line 77
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}
```

## 🧪 Testing Steps

1. Navigate to `/profile` route
2. Observe if header flashes then scrolls away
3. Check browser console for any scroll events
4. Use DevTools to inspect which element is scrolling
5. Check React DevTools for component render timing

## 💡 Potential Solutions to Explore

1. **React Router ScrollRestoration component** - If available, configure it properly
2. **Prevent scroll restoration at browser level** - More aggressive browser API usage
3. **Use CSS to lock scroll position** - More aggressive CSS locking
4. **Force component remount** - Already tried with `key` prop
5. **Intercept scroll events earlier** - Use MutationObserver or other techniques
6. **Different scroll container strategy** - Maybe window scroll instead of element scroll
7. **React Router configuration** - Check if there's router-level scroll config

## 📚 Additional Context

- The app uses React Router v6
- Uses lazy loading for routes
- Has a fixed bottom navigation
- Uses safe area insets for mobile (iOS)
- Profile page has a cover image that might cause layout shifts

---

**Please help identify why scroll restoration is still happening despite all our attempts to prevent it.**



