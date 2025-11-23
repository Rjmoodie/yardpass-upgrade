# ✅ Deep Link Share Fix - "Something Went Wrong" Error

## Problem

When clicking shared event slug links in the iOS/Android app, users see "Something went wrong, please try again" error. Links work fine on mobile browser but not in the native app.

## Root Cause

The `appUrlOpen` listener in `src/lib/capacitor-init.ts` was only logging the URL but **not handling navigation**. When a shared link like `https://liventix.tech/e/event-slug` was clicked, the event fired but nothing navigated to the route, causing the app to show an error.

## Solution ✅

### 1. Created Deep Link Handler Utility
**File:** `src/utils/deepLinkHandler.ts`

**Features:**
- Parses URLs from shared links (handles both `liventix.com` and `liventix.tech`)
- Supports app scheme URLs (`liventix://`)
- Extracts pathname and query parameters
- Converts URL paths to React Router routes:
  - `/e/:slug` → `/e/:identifier`
  - `/p/:id` → `/post/:id`
  - `/u/:username` → `/profile/:username`
  - `/org/:slug` → `/org/:slug`

### 2. Updated Capacitor Deep Link Listener
**File:** `src/lib/capacitor-init.ts`

**Before:**
```typescript
await App.addListener('appUrlOpen', (event) => {
  console.log('[Capacitor] Deep link opened:', event.url);
  // Deep link handling will be done in the router  ❌ Nothing happened
});
```

**After:**
```typescript
await App.addListener('appUrlOpen', (event) => {
  console.log('[Capacitor] Deep link opened:', event.url);
  // Emit a custom event that the app can listen to for navigation
  window.dispatchEvent(new CustomEvent('deepLinkOpen', { 
    detail: { url: event.url } 
  }));
});
```

### 3. Added Deep Link Handler in App Component
**File:** `src/App.tsx`

**Features:**
- Listens for `deepLinkOpen` custom events
- Parses the URL using the deep link handler
- Navigates to the correct route using React Router
- Handles launch URLs (when app is opened from a shared link)
- Shows appropriate error messages if parsing fails

**Code:**
```typescript
useEffect(() => {
  const handleDeepLinkEvent = async (event: CustomEvent<{ url: string }>) => {
    try {
      const { handleDeepLink } = await import('@/utils/deepLinkHandler');
      const route = handleDeepLink(event.detail.url);
      
      if (route) {
        console.log('[App] Navigating to deep link route:', route);
        navigate(route, { replace: false });
      } else {
        toast({
          title: "Invalid link",
          description: "This link could not be opened in the app.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[App] Error handling deep link:', error);
      toast({
        title: "Something went wrong",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  window.addEventListener('deepLinkOpen', handleDeepLinkEvent as EventListener);
  
  // Handle launch URLs (app opened from shared link)
  if (Capacitor.isNativePlatform()) {
    import('@capacitor/app').then(({ App }) => {
      App.getLaunchUrl().then((result) => {
        if (result?.url) {
          handleDeepLinkEvent(new CustomEvent('deepLinkOpen', { detail: { url: result.url } }));
        }
      });
    });
  }

  return () => {
    window.removeEventListener('deepLinkOpen', handleDeepLinkEvent as EventListener);
  };
}, [navigate, toast]);
```

### 4. Updated Share URL Domain
**File:** `src/lib/shareLinks.ts`

**Change:** Updated share URLs to use `liventix.tech` (matching app deployment) instead of `liventix.com`

```typescript
// Before: https://liventix.com/e/${t.slug}
// After:  https://liventix.tech/e/${t.slug}
```

---

## Supported URL Patterns

The deep link handler supports these patterns:

1. **Events:**
   - `https://liventix.tech/e/event-slug`
   - `liventix://e/event-slug`

2. **Posts:**
   - `https://liventix.tech/p/post-id`
   - `https://liventix.tech/post/post-id`
   - `liventix://p/post-id`

3. **Users:**
   - `https://liventix.tech/u/username`
   - `https://liventix.tech/profile/username`
   - `liventix://u/username`

4. **Organizations:**
   - `https://liventix.tech/org/org-slug`
   - `liventix://org/org-slug`

---

## Testing Checklist

- [ ] Share an event from the app
- [ ] Click the shared link in Messages/iMessage
- [ ] Verify app opens and navigates to event page
- [ ] Share a post from the app
- [ ] Click the shared post link
- [ ] Verify app opens and navigates to post
- [ ] Share a user profile
- [ ] Click the shared profile link
- [ ] Verify app opens and navigates to profile
- [ ] Test on iOS device
- [ ] Test on Android device
- [ ] Test with app closed (launch URL)
- [ ] Test with app open (deep link)

---

## Files Modified

1. ✅ `src/utils/deepLinkHandler.ts` - **NEW** - Deep link parsing and routing
2. ✅ `src/lib/capacitor-init.ts` - Updated to dispatch custom event
3. ✅ `src/App.tsx` - Added deep link listener and navigation handler
4. ✅ `src/lib/shareLinks.ts` - Updated domain to `liventix.tech`

---

## Expected Result

✅ When clicking a shared event slug link in the app:
1. Capacitor fires `appUrlOpen` event
2. Custom `deepLinkOpen` event is dispatched
3. App component handles the event
4. URL is parsed to extract route
5. React Router navigates to the correct page
6. Event details page loads successfully

**No more "Something went wrong" errors!** 🎉

