# Profile Saved Section Fixed 🔖✅

## Problem
Saved posts weren't appearing in the profile's "Saved" section, even though the save action was working.

## Root Cause
The ProfilePage was only querying `saved_events` table (events only), not the unified `user_saved_items` view (events + posts).

---

## ✅ Solution Implemented

### Updated: `src/pages/new-design/ProfilePage.tsx`

#### 1. Updated Interface (Line 42-52)
```typescript
// BEFORE: Only supported events
interface UserEvent {
  id: string;
  title: string;
  cover_image_url: string | null;
  start_at: string;
  is_flashback?: boolean;
}

// AFTER: Supports both events and posts
interface SavedItem {
  id: string;
  item_type: 'event' | 'post';
  item_id: string;
  title: string;
  cover_image_url: string | null;
  start_at: string;
  is_flashback?: boolean;
  post_media_urls?: string[] | null;
  post_text?: string | null;
}
```

#### 2. Updated State (Line 64)
```typescript
// BEFORE:
const [savedEvents, setSavedEvents] = useState<UserEvent[]>([]);

// AFTER:
const [savedEvents, setSavedEvents] = useState<SavedItem[]>([]);
```

#### 3. Updated Query (Lines 186-224)
```typescript
// BEFORE: Only queried saved_events
const { data, error } = await supabase
  .from('saved_events')
  .select(`
    id, event_id,
    events (id, title, cover_image_url, start_at, is_flashback)
  `)
  .eq('user_id', profile.user_id);

// AFTER: Queries unified view
const { data, error } = await supabase
  .from('user_saved_items')  // ✅ Unified view
  .select('*')
  .eq('user_id', profile.user_id)
  .order('saved_at', { ascending: false });

// Transform to handle both types
const items: SavedItem[] = (data || []).map((item: any) => ({
  id: item.id,
  item_type: item.item_type,         // 'event' or 'post'
  item_id: item.item_id,
  title: item.event_title || 'Untitled',
  cover_image_url: item.item_type === 'event' 
    ? item.event_cover_image 
    : (item.post_media_urls?.[0] || item.event_cover_image),
  start_at: item.event_start_at,
  post_media_urls: item.post_media_urls,
  post_text: item.post_text,
}));
```

#### 4. Updated Display Logic (Lines 244-265)
```typescript
// BEFORE: Only showed events
return savedEvents.map(e => ({
  id: e.id,
  image: e.cover_image_url || '',
  type: 'event' as const,
}));

// AFTER: Shows both events and posts
return savedEvents.map(e => {
  // Handle media URLs - convert Mux if needed
  let imageUrl = e.cover_image_url || '';
  if (e.item_type === 'post' && e.post_media_urls?.[0]) {
    const rawUrl = e.post_media_urls[0];
    imageUrl = rawUrl.startsWith('mux:') 
      ? muxToPoster(rawUrl) 
      : rawUrl;
  }
  
  return {
    id: e.item_id,          // ✅ Use item_id (either event_id or post_id)
    image: imageUrl,        // ✅ Handle both event covers and post media
    type: e.item_type,      // ✅ 'event' or 'post'
    event_id: e.item_type === 'event' ? e.item_id : undefined,
  };
});
```

---

## 🎯 What This Fixes

### Before:
- ✅ Save post → Works
- ❌ View saved section → Only shows saved events
- ❌ Saved posts missing from display

### After:
- ✅ Save post → Works
- ✅ View saved section → Shows **both** saved events AND posts
- ✅ Saved posts appear immediately

---

## 📱 User Experience

### Profile "Saved" Tab Now Shows:

1. **Saved Event Cards** (orange "Event" tag)
   - Event cover image
   - Event title
   - Click → Navigate to `/e/{eventId}`

2. **Saved Posts** (orange "Event" tag)
   - Post image/video thumbnail
   - From the event
   - Click → Open post modal

### Display Features:
- ✅ Mixed feed of events + posts
- ✅ Sorted by `saved_at` (most recent first)
- ✅ Mux video thumbnails auto-generated
- ✅ Real-time count: "Saved {count}"

---

## 🔗 Related Components

All 3 migrations working together:

1. **`20250207000100_fix_saved_posts_and_unify.sql`**
   - Created `user_saved_items` unified view
   - Auto-populates `event_id` from post

2. **`20250207000101_fix_rls_for_saved_posts.sql`**
   - Fixed RLS bypass with `SECURITY DEFINER`
   - Resolved 403 permission errors

3. **`src/pages/new-design/ProfilePage.tsx`** (THIS FIX)
   - Updated frontend to use unified view
   - Displays both saved events and posts

---

## 🧪 Test It

1. **Save a post** (from feed or event page)
2. **Navigate to your profile**
3. **Click "Saved" tab**
4. **See the post appear** alongside saved events ✅

---

## ✨ Bonus: Feed Integration

Saved posts now also contribute to feed ranking:
- Weight: 5.0 (highest purchase intent)
- Half-life: 21 days
- Effect: Events with saved posts rank higher in feed

---

**Everything is now fully integrated!** 🎉

Saved posts:
- ✅ Can be saved (no 403 error)
- ✅ Appear in profile "Saved" section
- ✅ Boost event ranking in feed
- ✅ Support both images and videos

Generated: November 7, 2025





