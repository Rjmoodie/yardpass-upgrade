# Scroll Flash - Debugging Guide

## 🚨 Current Status
Scroll restoration is STILL happening despite all our fixes. This guide will help debug what's causing it.

## 🔍 Step 1: Identify What's Scrolling

Open browser console and run:

```javascript
// Track all scroll events with call stack
let scrollEvents = [];
document.addEventListener('scroll', (e) => {
  const main = document.getElementById('main-content');
  const event = {
    timestamp: Date.now(),
    windowY: window.scrollY,
    mainScrollTop: main?.scrollTop || 0,
    docScrollTop: document.documentElement.scrollTop,
    bodyScrollTop: document.body.scrollTop,
    target: e.target?.tagName || 'unknown',
    stack: new Error().stack.split('\n').slice(1, 6).join('\n')
  };
  scrollEvents.push(event);
  console.log('🔄 Scroll detected:', event);
}, { capture: true });

// After navigating, check what happened:
console.log('All scroll events:', scrollEvents);
```

## 🔍 Step 2: Check React Router

React Router v6 doesn't have built-in scroll restoration, but check:

```javascript
// In browser console
import { useLocation } from 'react-router-dom';
// Check if location state has scroll position
console.log('Location state:', window.location);
```

## 🔍 Step 3: Check for Layout Shifts

The flash might be from content loading causing layout shift:

```javascript
// Check for layout shifts
new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (entry.value > 0.1) {
      console.warn('⚠️ Layout shift detected:', entry);
    }
  });
}).observe({ entryTypes: ['layout-shift'] });
```

## 🎯 Possible Solutions

### Solution 1: Force Remount on Route Change
Add a `key` prop to routes to force complete remount:

```tsx
<Routes key={location.pathname}>
  {/* routes */}
</Routes>
```

### Solution 2: Temporary Scroll Lock
Lock scrolling entirely during route transition:

```css
/* Add to index.css */
html.scroll-locked {
  overflow: hidden !important;
  position: fixed !important;
  width: 100% !important;
}

html.scroll-locked body {
  overflow: hidden !important;
}
```

Then in ScrollRestorationManager:
```tsx
useLayoutEffect(() => {
  document.documentElement.classList.add('scroll-locked');
  // ... reset logic ...
  setTimeout(() => {
    document.documentElement.classList.remove('scroll-locked');
  }, 300);
}, [location.pathname]);
```

### Solution 3: Save Scroll Position as 0 Before Navigation
Intercept navigation and ensure scroll is 0:

```tsx
// Before navigation
const navigate = useNavigate();
const navigateWithScrollReset = (path: string) => {
  const main = document.getElementById('main-content');
  if (main) main.scrollTop = 0;
  window.scrollY = 0;
  navigate(path);
};
```

### Solution 4: Use React Router's PreventScrollReset
React Router v6.4+ has a `preventScrollReset` prop:

```tsx
<Route 
  path="/profile/:id" 
  element={<ProfilePage />}
  preventScrollReset={false} // Ensure scroll resets
/>
```

## 📝 What to Report

If you run the debugging code above, report:
1. **When does scroll happen?** (timestamp relative to navigation)
2. **What's the call stack?** (what function triggered the scroll)
3. **Which element scrolled?** (window, main-content, document, body)
4. **Are there layout shifts?** (from PerformanceObserver)

This will help identify the root cause.

