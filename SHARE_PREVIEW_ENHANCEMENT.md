# 📱 Share Preview Enhancement

**Date:** January 2025  
**Status:** ✅ Implemented

---

## 🎯 Overview

Enhanced share previews for events, posts, and media across all platforms (WhatsApp, iMessage, Twitter, Facebook, etc.) with rich Open Graph and Twitter Card metadata.

---

## ✨ What Was Implemented

### 1. **Shared OG Payload Type** (`src/types/og.ts`)

**Single source of truth** for OG metadata across client and server:
- `OgPayload` interface with required fields (title, description, image, url)
- Builder functions: `buildEventOgPayload()` and `buildPostOgPayload()`
- Timezone normalization: `normalizeToIsoUtc()` ensures ISO 8601 UTC format
- Default fallback payload for error cases

**Key Benefits:**
- Ensures consistency between client-side and server-side OG rendering
- Prevents divergence bugs where in-app previews differ from social links
- Centralized logic for building OG data from event/post objects

### 2. **Enhanced Meta Tag Utility** (`src/utils/meta.ts`)

**Strengthened API:**
- Uses shared `OgPayload` type (ensures consistency)
- Required field validation (title, description, image, url)
- Automatic canonical URL management
- Comprehensive Open Graph and Twitter Card support

**Usage:**
```typescript
import { buildEventOgPayload } from '@/types/og';
import { updateMetaTags } from '@/utils/meta';

// Build payload using shared builder
const ogPayload = buildEventOgPayload(eventData);
updateMetaTags(ogPayload);
```

### 3. **Dynamic Client-Side Meta Tags** (`src/pages/new-design/EventDetailsPage.tsx`)

When an event page loads:
- Uses `buildEventOgPayload()` to create consistent OG payload
- Automatically updates meta tags via `updateMetaTags()`
- Sets canonical URL for SEO
- All metadata matches server-side rendering

### 4. **Server-Side OG Preview Edge Function** (`supabase/functions/og-preview/index.ts`)

**Purpose:** Social media crawlers (WhatsApp, iMessage, Twitter, Facebook) don't execute JavaScript, so they need server-rendered HTML with meta tags.

**Key Features:**
- **Crawler Detection:** Automatically detects known crawler user agents
- **Smart Redirects:** Non-crawlers are redirected (307) to canonical URL (`/e/{id}` or `/post/{id}`)
- **Canonical URLs:** Always points to user-facing URL, not `/og-preview`
- **Consistent Payloads:** Uses same builder logic as client-side (mirrored)
- **Graceful Fallbacks:** Returns default OG tags with 404 status if event/post not found
- **Timezone Normalization:** Converts all dates to ISO 8601 UTC format

**Endpoints:**
- **Events:** `/og-preview?type=event&id={event_id}`
- **Posts:** `/og-preview?type=post&id={post_id}`

**Important:** 
- `/og-preview` is **crawler-only** and not intended for human users
- Humans should always share `/e/{id}` or `/post/{id}` URLs
- The function automatically redirects non-crawlers to the canonical URL

### 4. **Updated Share URLs** (`supabase/functions/share-event/index.ts`)

- All share URLs now use `liventix.tech` domain consistently
- Event URLs use format: `https://liventix.tech/e/{id}`

### 5. **Default Meta Tags** (`index.html`)

Updated default Open Graph and Twitter Card tags to:
- Use `liventix.tech` domain
- Include image dimensions
- Reference `/og-image.jpg` as fallback

---

## 🔄 How It Works

### For In-App Navigation (Client-Side)

1. User navigates to event page (`/e/{id}`)
2. `EventDetailsPage` loads event data
3. `buildEventOgPayload()` creates consistent OG payload
4. `updateMetaTags()` updates meta tags in `<head>` and sets canonical URL
5. If user shares from within the app, browser's share sheet uses these tags

### For Social Media Crawlers (Server-Side)

1. **User shares canonical URL:** `https://liventix.tech/e/{id}` (this is what humans should share)
2. Social platform crawler requests the URL
3. **Current Implementation:** Since we're using client-side routing (SPA), crawlers need the OG preview endpoint
4. **Future Enhancement:** If app is deployed with SSR, crawler can get meta tags directly from server-rendered HTML
5. **OG Preview Flow (Current):**
   - Crawler requests `/og-preview?type=event&id={id}` (or platform may auto-discover)
   - Edge Function detects crawler user-agent
   - Function fetches event data and builds OG payload (same logic as client-side)
   - Returns HTML with complete meta tags and canonical URL pointing to `/e/{id}`
   - Crawler parses meta tags and displays rich preview

**Important Notes:**
- We expect users to share `/e/{id}` URLs, not `/og-preview` URLs
- `/og-preview` is used internally for social crawlers and not intended for humans
- If a human accidentally visits `/og-preview`, they're automatically redirected to the canonical URL

---

## 📋 Implementation Checklist

- [x] Created shared `OgPayload` type for single source of truth
- [x] Enhanced `meta.ts` utility with validation and canonical URLs
- [x] Added dynamic meta tag updates to `EventDetailsPage` using shared builders
- [x] Created `og-preview` Edge Function with crawler detection
- [x] Implemented smart redirects for non-crawlers to canonical URLs
- [x] Added canonical URL management (client and server)
- [x] Normalized timezone handling (ISO 8601 UTC)
- [x] Improved fallback behavior (default OG tags with proper status codes)
- [x] Updated `share-event` function to use `liventix.tech` domain
- [x] Updated default meta tags in `index.html`
- [ ] Deploy `og-preview` Edge Function
- [ ] Create `/og-image.jpg` fallback image (1200x630px)
- [ ] Test with social media debuggers:
  - [ ] WhatsApp link preview
  - [ ] Twitter Card validator
  - [ ] Facebook Debugger
  - [ ] LinkedIn Post Inspector
- [ ] Add automated smoke tests for OG preview endpoint

---

## 🚀 Next Steps

### 1. Deploy Edge Function

```bash
supabase functions deploy og-preview
```

### 2. Create OG Fallback Image

Create a 1200x630px image at `/public/og-image.jpg` with:
- Liventix logo
- Tagline: "Live Event Tickets"
- Brand colors

### 3. Test Share Previews

**WhatsApp:**
1. Share event link in WhatsApp
2. Verify preview shows event image, title, description

**Twitter:**
1. Use [Twitter Card Validator](https://cards-dev.twitter.com/validator)
2. Enter event URL
3. Verify card preview

**Facebook:**
1. Use [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
2. Enter event URL
3. Verify Open Graph preview

### 4. Optional: Add Post Detail Pages

Currently, posts are shown in modals. If you want dedicated post pages:
- Create `/post/{id}` route
- Add `PostDetailsPage` component
- Update meta tags when post loads
- Update OG preview function (already supports posts)

---

## 📝 Notes

- **Client-side meta tags** work for in-app sharing and some platforms
- **Server-side OG preview** is required for WhatsApp, iMessage, and most social platforms
- **Image dimensions** (1200x630) are optimal for most platforms
- **Fallback image** ensures previews always have an image
- **Consistent URLs** (`liventix.tech`) ensure proper link previews

---

## 🔍 Troubleshooting

### Preview Not Showing Image

1. Check image URL is accessible (not behind auth)
2. Verify image dimensions are correct (1200x630 recommended)
3. Check image format (JPEG/PNG, not WebP for better compatibility)
4. Ensure image URLs are absolute (https://liventix.tech/...), not relative

### Preview Showing Wrong Data

1. **Clear social platform cache** (platforms cache aggressively):
   - Facebook: Use [Sharing Debugger](https://developers.facebook.com/tools/debug/) → "Scrape Again"
   - Twitter: Use [Card Validator](https://cards-dev.twitter.com/validator)
   - LinkedIn: Use [Post Inspector](https://www.linkedin.com/post-inspector/)
2. Verify Edge Function is deployed: `supabase functions list`
3. Check function logs: `supabase functions logs og-preview`
4. Verify client-side meta tags are updating (check browser console)

### OG Preview Returns 404

1. Verify Edge Function is deployed: `supabase functions list`
2. Check function logs: `supabase functions logs og-preview`
3. Verify event/post ID exists in database
4. Check if request is from a crawler (non-crawlers get redirected)

### Human Users Landing on /og-preview

- This shouldn't happen, but if it does:
  - The function automatically redirects (307) to canonical URL
  - If redirect isn't working, check user-agent detection logic
  - Verify canonical URL is correct: `/e/{id}` for events, `/post/{id}` for posts

### In-App Preview Differs from Social Preview

- This indicates a divergence between client and server OG payloads
- Check that both use the same builder functions (`buildEventOgPayload`, `buildPostOgPayload`)
- Verify timezone normalization is consistent (ISO 8601 UTC)
- Ensure image URLs are identical in both contexts

---

## 🎯 Architecture Decisions

### Single Source of Truth

We use a shared `OgPayload` type and builder functions to ensure:
- Client-side meta tags match server-side OG rendering
- No divergence bugs where previews differ
- Easier maintenance (change once, works everywhere)

### Crawler-Only OG Endpoint

The `/og-preview` endpoint:
- Detects crawlers via user-agent patterns
- Redirects humans to canonical URLs (prevents confusion)
- Only serves OG HTML to known crawlers
- Ensures humans always see the actual app, not a meta tag page

### Canonical URLs

- Always point to user-facing URLs (`/e/{id}`, `/post/{id}`)
- Never point to `/og-preview` (prevents duplicate content issues)
- Set in both client-side meta tags and server-side OG HTML
- Helps search engines index the correct URLs

### Timezone Handling

- All dates normalized to ISO 8601 UTC format
- Consistent across client and server
- Prevents timezone-related display issues
- Uses `normalizeToIsoUtc()` helper function

## 📚 References

- [Open Graph Protocol](https://ogp.me/)
- [Twitter Cards](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

