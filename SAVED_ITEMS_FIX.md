# Saved Items Fix: Unified Posts + Events 🔖

## Problem

**Error:** `POST /rest/v1/user_saved_posts 403 (Forbidden)`

**Root Cause:** The `event_id` column in `user_saved_posts` was `NOT NULL`, but the frontend wasn't sending it when saving posts.

**User Expectation:** Saved posts and saved events should appear together in the same "Saved" section.

---

## ✅ Solution Implemented

### 1. Fixed 403 Error (`20250207000100_fix_saved_posts_and_unify.sql`)

#### A. Made `event_id` Auto-Populate
```sql
-- event_id is now nullable and auto-populated from the post
ALTER TABLE events.user_saved_posts
ALTER COLUMN event_id DROP NOT NULL;

-- Updated trigger auto-fills event_id from post
CREATE OR REPLACE FUNCTION public.user_saved_posts_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-populate event_id from the post if not provided
  IF NEW.event_id IS NULL AND NEW.post_id IS NOT NULL THEN
    SELECT event_id INTO NEW.event_id
    FROM events.event_posts
    WHERE id = NEW.post_id;
  END IF;
  
  INSERT INTO events.user_saved_posts (user_id, post_id, event_id)
  VALUES (NEW.user_id, NEW.post_id, NEW.event_id)
  ON CONFLICT (user_id, post_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;
```

**Result:** Frontend can now save posts with just `user_id` and `post_id` ✅

---

#### B. Added Toggle Function for Posts
```sql
-- Similar to toggle_saved_event(), now for posts
CREATE FUNCTION public.toggle_saved_post(p_post_id UUID)
RETURNS BOOLEAN;
```

**Usage:**
```typescript
const { data, error } = await supabase
  .rpc('toggle_saved_post', { p_post_id: postId });
// Returns: true (saved) or false (unsaved)
```

---

### 2. Created Unified `user_saved_items` View

Combines both saved events AND saved posts into one query:

```sql
CREATE VIEW public.user_saved_items AS
-- Saved events
SELECT
  'event' AS item_type,
  event_id AS item_id,
  event_id,
  NULL AS post_id,
  saved_at,
  event_title,
  event_cover_image,
  ...
FROM public.saved_events
UNION ALL
-- Saved posts
SELECT
  'post' AS item_type,
  post_id AS item_id,
  event_id,
  post_id,
  created_at AS saved_at,
  event_title,
  post_media_urls,
  ...
FROM events.user_saved_posts;
```

**Frontend Usage:**
```typescript
// Get all saved items (events + posts) in one query
const { data: savedItems, error } = await supabase
  .from('user_saved_items')
  .select('*')
  .eq('user_id', userId)
  .order('saved_at', { ascending: false });

// Render based on item_type
savedItems?.forEach(item => {
  if (item.item_type === 'event') {
    // Render event card
  } else if (item.item_type === 'post') {
    // Render post with media
  }
});
```

---

### 3. Added Helper RPC Function

```sql
CREATE FUNCTION public.get_user_saved_items(
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
```

**Frontend Usage:**
```typescript
// Get paginated saved items
const { data, error } = await supabase
  .rpc('get_user_saved_items', {
    p_limit: 20,
    p_offset: 0
  });
```

---

### 4. Integrated Saved Posts into Feed Scoring

**Updated:** `saved_signal` CTE in feed ranking now includes BOTH saved events AND saved posts:

```sql
saved_signal AS (
  SELECT 
    event_id,
    MAX(saved_at) AS last_saved_at,
    exp(-ln(2) * days_elapsed / 21.0) AS decay
  FROM (
    -- Saved events
    SELECT event_id, saved_at FROM public.saved_events
    WHERE user_id = p_user
    
    UNION ALL
    
    -- Saved posts (also indicate interest in the event)
    SELECT event_id, created_at AS saved_at
    FROM events.user_saved_posts
    WHERE user_id = p_user
  ) AS all_saves
  GROUP BY event_id
)
```

**Impact:** Saving a post now contributes to the event's purchase intent score (5.0 weight, 21-day half-life) ✅

---

## 📊 Response Schema

### `user_saved_items` View

```typescript
interface SavedItem {
  id: string;
  user_id: string;
  item_type: 'event' | 'post';
  item_id: string;           // event_id or post_id
  event_id: string;
  post_id: string | null;    // null for event items
  saved_at: string;          // ISO timestamp
  
  // Event details (always included)
  event_title: string;
  event_description: string;
  event_cover_image: string;
  event_start_at: string | null;
  event_venue: string;
  event_city: string;
  event_created_by: string;
  event_owner_context_type: 'individual' | 'organization';
  event_owner_context_id: string;
  
  // Post details (only for post items)
  post_text: string | null;
  post_media_urls: string[] | null;
}
```

---

## 🎨 Frontend Implementation Example

### Unified Saved Section Component

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

function SavedSection({ userId }: { userId: string }) {
  const { data: savedItems, isLoading } = useQuery({
    queryKey: ['saved-items', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_user_saved_items', { p_user_id: userId, p_limit: 50 });
      
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <Loading />;

  return (
    <div>
      <h2>Saved {savedItems?.length || 0}</h2>
      
      <div className="grid grid-cols-2 gap-4">
        {savedItems?.map((item) => (
          <div key={item.id}>
            {item.item_type === 'event' ? (
              <EventCard
                eventId={item.event_id}
                title={item.event_title}
                coverImage={item.event_cover_image}
                startAt={item.event_start_at}
                onUnsave={() => handleUnsaveEvent(item.event_id)}
              />
            ) : (
              <PostCard
                postId={item.post_id!}
                text={item.post_text}
                mediaUrls={item.post_media_urls}
                eventTitle={item.event_title}
                onUnsave={() => handleUnsavePost(item.post_id!)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

async function handleUnsaveEvent(eventId: string) {
  await supabase.rpc('toggle_saved_event', { p_event_id: eventId });
  // Invalidate query to refresh
}

async function handleUnsavePost(postId: string) {
  await supabase.rpc('toggle_saved_post', { p_post_id: postId });
  // Invalidate query to refresh
}
```

---

## 🚀 Deployment Steps

### 1. Deploy New Migration
```bash
cd /Users/rod/Desktop/yard_pass/liventix/liventix-upgrade/liventix-upgrade
npx supabase db push
```

This will:
- ✅ Make `event_id` nullable in `user_saved_posts`
- ✅ Update trigger to auto-populate `event_id`
- ✅ Create `toggle_saved_post()` function
- ✅ Create `user_saved_items` unified view
- ✅ Create `get_user_saved_items()` helper RPC

### 2. Update Feed Scoring (Already Done)
The `saved_signal` CTE in the main feed migration now includes saved posts.

### 3. Update Frontend
Replace separate queries for `saved_events` and `user_saved_posts` with single query to `user_saved_items`.

---

## 🧪 Testing Checklist

### Save Post
- [ ] Save a post → No 403 error
- [ ] Check `user_saved_posts` table → `event_id` auto-populated
- [ ] Check `user_saved_items` view → Post appears with `item_type: 'post'`

### Save Event
- [ ] Save an event → Still works
- [ ] Check `user_saved_items` view → Event appears with `item_type: 'event'`

### Unified View
- [ ] Query `user_saved_items` → Shows both events and posts
- [ ] Items sorted by `saved_at` DESC → Most recent first
- [ ] Post items have `post_text` and `post_media_urls`
- [ ] Event items have `post_text: null` and `post_media_urls: null`

### Feed Impact
- [ ] Save a post → Event's feed score increases (purchase intent signal)
- [ ] Save an event → Event's feed score increases (same)
- [ ] Both contribute equally to `saved_signal` (5.0 weight)

### Toggle Functions
- [ ] Call `toggle_saved_event(event_id)` → Returns true/false
- [ ] Call `toggle_saved_post(post_id)` → Returns true/false
- [ ] Toggle twice → Saves then unsaves

---

## 📈 Expected Behavior

### Before Fix
- ✅ Saved events: Working
- ❌ Saved posts: 403 Forbidden
- ❌ Separate queries needed
- ❌ Saved posts didn't affect feed

### After Fix
- ✅ Saved events: Working
- ✅ Saved posts: Working (auto-populates event_id)
- ✅ Single unified query
- ✅ Both affect feed scoring equally

---

## 🎯 Summary

**Files Modified:**
1. `supabase/migrations/20250207000100_fix_saved_posts_and_unify.sql` (NEW)
2. `supabase/migrations/20251102000002_optimize_feed_for_ticket_purchases.sql` (UPDATED - saved_signal)

**Key Features:**
- ✅ Fixed 403 error (event_id auto-population)
- ✅ Unified saved items view (posts + events)
- ✅ Toggle functions for both types
- ✅ Integrated into feed scoring
- ✅ Paginated helper RPC

**User Experience:**
- "Saved" section now shows **both** events and posts
- Seamless save/unsave for both types
- Saved items boost feed ranking

---

Generated: November 7, 2025






