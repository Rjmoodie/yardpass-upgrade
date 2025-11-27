# Scroll Restoration Issue - Summary

## 🎯 The Problem

When navigating to the profile page (`/profile`), the page briefly shows the correct header (with cover image, back button, theme toggle, share button, etc.) but then **immediately scrolls down**, making it appear as if the header "reverted" to an older design. In reality, the header is still there - the page is just scrolled down, hiding the header section.

### What's Happening

1. **Initial render**: Profile page renders correctly at `scrollTop = 0` → Header visible ✅
2. **Scroll restoration**: Browser/router restores previous scroll position for the scroll container → Header scrolls out of view ❌
3. **Result**: User sees only the profile content (avatar, stats, posts) without the header, making it look like the design "reverted"

## 🔍 Root Cause

The **`FullScreenSafeArea` component** is the scroll container (has `overflow-y-auto` and fixed height `100dvh`). When navigating between routes, React Router reuses the same scroll container element, and the browser/router restores the previous `scrollTop` value, causing the "flash then revert" effect.

## 📁 Files We've Been Working On

### 1. **`src/components/layout/FullScreenSafeArea.tsx`**
   - **Purpose**: Main scroll container for pages
   - **Changes Made**:
     - Added `useLayoutEffect` to reset scroll synchronously before browser paint
     - Added `useEffect` with multiple timing attempts to catch delayed restoration
     - Added ref to track scroll container
     - Imports `useLocation` from react-router-dom to detect route changes
   - **Status**: ✅ Modified with scroll reset logic

### 2. **`src/pages/new-design/ProfilePage.tsx`**
   - **Purpose**: The profile page that experiences the scroll restoration issue
   - **Changes Made**:
     - Set `scroll={false}` on its `FullScreenSafeArea` (prevents nested scrolling)
     - Added `useLayoutEffect` for immediate scroll reset
     - Added aggressive `useEffect` with multiple reset attempts
     - Added direct scroll reset in render (though this should be removed - not best practice)
   - **Status**: ✅ Modified with scroll reset logic

### 3. **`src/App.tsx`**
   - **Purpose**: Main app layout with the top-level `FullScreenSafeArea` scroll container
   - **Changes Made**:
     - Added scroll reset `useEffect` on route change
     - Added `mainContentRef` to track main element
     - Removed `overflow-y-auto` from `<main>` element (FullScreenSafeArea handles scrolling)
     - Attempted to add `key={location.pathname}` to force remount (later removed)
   - **Status**: ✅ Modified with scroll reset logic

### 4. **`src/main.tsx`**
   - **Purpose**: App entry point where BrowserRouter is configured
   - **Changes Made**:
     - Added `window.history.scrollRestoration = 'manual'` to disable browser scroll restoration
   - **Status**: ✅ Modified to disable browser scroll restoration

### 5. **`src/index.css`**
   - **Purpose**: Global CSS styles
   - **Changes Made**:
     - None directly (already had scroll-related CSS)
   - **Status**: ⚠️ Checked but no changes needed

## 🔧 Fixes Attempted

### Fix 1: Disable Browser Scroll Restoration
- **File**: `src/main.tsx`
- **Action**: Set `window.history.scrollRestoration = 'manual'`
- **Status**: ✅ Implemented

### Fix 2: Reset Scroll on Route Change in FullScreenSafeArea
- **File**: `src/components/layout/FullScreenSafeArea.tsx`
- **Action**: Added `useLayoutEffect` + `useEffect` to reset `scrollTop = 0` when route changes
- **Status**: ✅ Implemented

### Fix 3: Reset Scroll in ProfilePage
- **File**: `src/pages/new-design/ProfilePage.tsx`
- **Action**: Added aggressive scroll reset with multiple timing attempts
- **Status**: ✅ Implemented

### Fix 4: Reset Scroll in App.tsx
- **File**: `src/App.tsx`
- **Action**: Added scroll reset on main element
- **Status**: ✅ Implemented

### Fix 5: Force Remount with Key (Option 2)
- **File**: `src/App.tsx`
- **Action**: Added `key={location.pathname}` to `FullScreenSafeArea` (forces remount)
- **Status**: ❌ Removed (caused remount on every route change)

## 🚨 Current Status

**Problem**: Scroll restoration is **still occurring** despite all fixes.

**Possible Issues**:
1. Scroll reset is happening but scroll is restored AFTER our resets
2. Wrong scroll container is being reset (there might be nested containers)
3. Browser/router scroll restoration is overriding our resets
4. Timing issue - scroll restoration happens after all our effects run

## 🔍 Next Steps to Debug

1. **Identify the actual scroll container**:
   - Open DevTools → Elements tab
   - Find which element has `overflow-y-auto` and is actually scrolling
   - Check its `scrollTop` value when the issue occurs

2. **Check scroll restoration timing**:
   - Add console.logs to see when scroll resets run vs when scroll is restored
   - Use React DevTools to check component lifecycle

3. **Consider alternative approaches**:
   - Remove scroll from FullScreenSafeArea entirely, use window scrolling
   - Use React Router's scroll restoration API
   - Prevent scroll restoration at the router level

## 📝 Key Architecture Points

```
App Structure:
├── FullScreenSafeArea (scroll={true}, overflow-y-auto) ← ACTUAL SCROLL CONTAINER
│   └── <main id="main-content"> (no overflow)
│       └── Routes
│           └── ProfilePage
│               └── FullScreenSafeArea (scroll={false}) ← Not scrolling
```

The scroll container is the **App-level FullScreenSafeArea**, not the ProfilePage's FullScreenSafeArea (which has `scroll={false}`).

