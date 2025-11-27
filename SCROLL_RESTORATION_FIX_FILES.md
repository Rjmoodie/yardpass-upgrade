# Files Causing Scroll Restoration Issue

## Problem
The profile page header disappears because scroll position is being restored from a previous visit.

## Root Causes

1. **BrowserRouter** (React Router v6) automatically restores scroll position by default
2. **Nested scroll containers** - ProfilePage creates a scroll container inside App's main scroll container
3. **Scroll restoration happens AFTER component mounts** - our resets get overridden

## Files to Fix

### 1. `src/main.tsx`
- **Issue**: BrowserRouter has scroll restoration enabled by default
- **Fix**: Disable scroll restoration at router level

### 2. `src/App.tsx`
- **Issue**: Has scroll reset but main element is scroll container
- **Fix**: Ensure scroll reset happens early and forcefully

### 3. `src/pages/new-design/ProfilePage.tsx`
- **Issue**: Creates its own FullScreenSafeArea scroll container (nested scrolling)
- **Fix**: Disable scroll on ProfilePage's FullScreenSafeArea, let parent handle it

### 4. `src/components/layout/FullScreenSafeArea.tsx`
- **Issue**: Scroll reset happens but gets overridden
- **Fix**: Make reset more aggressive and earlier

### 5. `src/index.css`
- **Issue**: CSS might be affecting scroll behavior
- **Status**: Should be fine, but check for conflicting styles

