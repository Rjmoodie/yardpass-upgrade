# Home Feed Optimization for Ticket Purchase Intent

## ✅ Completed Changes

### 1. SQL Migration Updates (`supabase/migrations/20251102000002_optimize_feed_for_ticket_purchases.sql`)

#### A. Fixed `user_price_profile` CROSS JOIN Bug
**Problem:** When a user had no paid orders, the `user_price_profile` CTE returned 0 rows, causing the `CROSS JOIN` to wipe out all rows in `purchase_intent`.

**Fix (Line 473):**
```sql
-- BEFORE:
CROSS JOIN user_price_profile upp

-- AFTER:
LEFT JOIN user_price_profile upp ON true  -- Fixed: LEFT JOIN prevents empty result when user has no orders
```

This ensures that users with no purchase history still see events in their feed.

---

#### B. Boosted Posts from Purchased Events
**Goal:** Strongly prioritize posts from events the user has already purchased tickets for, while still hiding event cards for those same events.

**Changes (Lines 668-684):**

```sql
-- BEFORE: Posts got a slight penalty vs event cards
se.score * 0.98 AS score

-- AFTER: Dynamic scoring based on purchase status
CASE
  WHEN ce.user_already_purchased THEN se.score * 1.2  -- 🔥 Strong boost for posts from events viewer has tickets for
  ELSE se.score * 0.98                                -- Slight penalty vs event cards for non-purchased events
END AS score
```

**Added JOIN (Line 681):**
```sql
JOIN candidate_events ce ON ce.event_id = rp.event_id  -- Added: needed for user_already_purchased check
```

**Result:**
- Event cards for purchased events: **Hidden** ✅
- Posts from purchased events: **Boosted 1.2x** ✅
- Posts from non-purchased events: **Slightly reduced 0.98x** (normal discovery)

---

### 2. Edge Function Updates (`supabase/functions/home-feed/index.ts`)

#### A. Fixed RPC Argument Mismatch (Line 459)
**Problem:** The edge function was sending `p_cursor_ts` and `p_cursor_score` which no longer exist in the new SQL signature.

**Fix:**
```typescript
// BEFORE:
if (cursor?.id) rpcArgs.p_cursor_item_id = cursor.id;
if (cursor?.ts) rpcArgs.p_cursor_ts = cursor.ts;
if (cursor?.score !== undefined) rpcArgs.p_cursor_score = cursor.score;

// AFTER:
if (cursor?.id) rpcArgs.p_cursor_item_id = cursor.id;
// ❌ Removed p_cursor_ts and p_cursor_score - new SQL uses ROW_NUMBER + p_cursor_item_id for pagination
```

---

#### B. Added Tickets Query for `is_attending` Tracking (Lines 686-694)

**Added:**
```typescript
// NEW: Query tickets to determine is_attending
const ticketsQ = viewerId && eventIds.length
  ? supabase
      .from("tickets")
      .select("event_id")
      .eq("owner_user_id", viewerId)
      .in("event_id", eventIds)
      .in("status", ["issued", "transferred", "redeemed"])
  : Promise.resolve({ data: [], error: null });
```

**Updated Promise.all (Line 696):**
```typescript
const [{ data: events, error: eventsError }, postsRes, sponsorsRes, likesRes, ticketsRes] =
  await Promise.all([eventsQ, postsQ, sponsorsQ, likesQ, ticketsQ]);
```

**Created attendingEventIds Set (Line 705):**
```typescript
const attendingEventIds = new Set((ticketsRes?.data ?? []).map((t: any) => t.event_id));
```

---

#### C. Added `is_attending` Field to Event Items (Line 818)

```typescript
return {
  item_type: "event",
  // ... all existing fields ...
  sponsor: primarySponsor,
  sponsors: sponsorList,
  is_attending: viewerId ? attendingEventIds.has(row.event_id) : false,  // NEW: viewer has tickets
};
```

**Frontend Usage:**
- `is_attending: true` → "You're Going" badge
- `is_attending: false` → Normal event card

---

#### D. Added `is_attending_event` Field to Post Items (Line 863)

```typescript
return {
  item_type: "post",
  // ... all existing fields ...
  sponsor: null,
  sponsors: null,
  is_attending_event: viewerId ? attendingEventIds.has(row.event_id) : false,  // NEW: viewer has tickets for this event
};
```

**Frontend Usage:**
- `is_attending_event: true` → "From an event you're attending" badge
- `is_attending_event: false` → Normal post

---

#### E. Updated Fallback to Respect Purchased Events (Lines 886-937)

**Added `viewerId` parameter:**
```typescript
async function fetchFallbackRows({
  supabase,
  limit,
  cursor,
  viewerId,  // NEW
}: {
  supabase: ReturnType<typeof createClient>;
  limit: number;
  cursor: { ts?: string | undefined } | null;
  viewerId: string | null;  // NEW
})
```

**Added filtering logic:**
```typescript
// Filter out events the viewer already has tickets for (consistent with ranked feed behavior)
if (viewerId && rows.length) {
  const eventIds = rows.map((r) => r.event_id);

  const { data: tickets } = await supabase
    .from("tickets")
    .select("event_id")
    .eq("owner_user_id", viewerId)
    .in("event_id", eventIds)
    .in("status", ["issued", "transferred", "redeemed"]);

  const purchased = new Set((tickets ?? []).map((t: any) => t.event_id));
  rows = rows.filter((r) => !purchased.has(r.event_id));
}
```

**Updated call site (Line 487):**
```typescript
ranked = await fetchFallbackRows({ supabase, limit: (limit as number) + 1, cursor, viewerId });
```

---

## 🎯 Expected Behavior

### For Event Cards
- **Show:** Future public events the user has NOT purchased tickets for
- **Hide:** Events the user has already purchased tickets for
- **Why:** Avoid redundant "Buy Tickets" CTAs after purchase

### For Event Posts
- **Boost 1.2x:** Posts from events the user HAS purchased tickets for
- **Normal 0.98x:** Posts from events the user has NOT purchased tickets for
- **Why:** Prioritize social engagement for events users are attending

### Response Shape

#### Event Item
```typescript
{
  item_type: "event",
  item_id: string,
  event_id: string,
  event_title: string,
  event_description: string,
  event_starts_at: string | null,
  event_cover_image: string,
  event_organizer: string,
  event_organizer_id: string | null,
  event_created_by: string | null,
  event_owner_context_type: "individual" | "organization",
  event_location: string,
  metrics: {
    likes: 0,
    comments: 0,
    viewer_has_liked: false,
    score: number | null,
  },
  sponsor: {...} | null,
  sponsors: [...] | null,
  is_attending: boolean,  // ✨ NEW: true if viewer has tickets
}
```

#### Post Item
```typescript
{
  item_type: "post",
  item_id: string,  // post id
  event_id: string,
  event_title: string,
  event_description: string,
  event_starts_at: string | null,
  event_cover_image: string,
  event_organizer: string,
  event_organizer_id: string | null,
  event_created_by: string | null,
  event_owner_context_type: "individual" | "organization",
  event_location: string,
  author_id: string | null,
  author_name: string | null,
  author_username: string | null,
  author_photo: string | null,
  author_badge: string | null,
  author_social_links: Array<any> | null,
  media_urls: string[],
  content: string,
  created_at: string | null,
  metrics: {
    likes: number,
    comments: number,
    viewer_has_liked: boolean,
    score: number | null,
  },
  sponsor: null,
  sponsors: null,
  is_attending_event: boolean,  // ✨ NEW: true if viewer has tickets for this event
}
```

---

## 📋 Deployment Steps

### 1. Deploy SQL Migration
```bash
cd /Users/rod/Desktop/yard_pass/liventix/liventix-upgrade/liventix-upgrade
npx supabase db push
```

**What this does:**
- Updates `get_home_feed_ids` function with LEFT JOIN fix
- Updates post scoring logic to boost purchased events

### 2. Deploy Edge Function
```bash
cd /Users/rod/Desktop/yard_pass/liventix/liventix-upgrade/liventix-upgrade
npx supabase functions deploy home-feed
```

**What this does:**
- Updates RPC call to use new pagination
- Adds `is_attending` and `is_attending_event` fields
- Filters fallback to respect purchased events

---

## 🧪 Testing Checklist

### As an Authenticated User WITH Purchased Tickets

1. **Event Cards:**
   - [ ] Do NOT see event cards for events you've purchased tickets for
   - [ ] DO see event cards for events you haven't purchased

2. **Posts:**
   - [ ] Posts from purchased events appear MORE frequently
   - [ ] Posts from purchased events have `is_attending_event: true`
   - [ ] Posts from non-purchased events have `is_attending_event: false`

3. **Event Items:**
   - [ ] Event items for purchased events have `is_attending: true`
   - [ ] Event items for non-purchased events have `is_attending: false`

### As an Authenticated User WITHOUT Purchased Tickets

1. **Event Cards:**
   - [ ] See event cards normally
   - [ ] All have `is_attending: false`

2. **Posts:**
   - [ ] Posts appear at normal frequency
   - [ ] All have `is_attending_event: false`

### As a Guest User

1. **Event Cards:**
   - [ ] See event cards normally
   - [ ] All have `is_attending: false`

2. **Posts:**
   - [ ] Posts appear at normal frequency
   - [ ] All have `is_attending_event: false`

---

## 🚨 Rollback Plan

If issues arise:

### 1. Revert SQL Migration
```sql
-- Change back to CROSS JOIN (will break for users with no orders)
CROSS JOIN user_price_profile upp

-- Revert post scoring
se.score * 0.98 AS score
```

### 2. Revert Edge Function
```bash
git checkout HEAD~1 supabase/functions/home-feed/index.ts
npx supabase functions deploy home-feed
```

---

## 📊 Metrics to Monitor

1. **Event Card CTR:** Should remain stable or improve (more relevant cards)
2. **Post Engagement:** Should increase for purchased events
3. **Ticket Purchase Rate:** Should improve (better targeting)
4. **Feed Load Time:** Should remain stable (parallel queries)
5. **Error Rate:** Should remain low (graceful fallbacks)

---

## 🎉 Summary

**Files Modified:**
1. `supabase/migrations/20251102000002_optimize_feed_for_ticket_purchases.sql`
2. `supabase/functions/home-feed/index.ts`

**Key Improvements:**
- ✅ Fixed CROSS JOIN bug that excluded users with no purchase history
- ✅ Event cards now hidden for purchased events (no redundant CTAs)
- ✅ Posts from purchased events boosted 1.2x (better engagement)
- ✅ Added `is_attending` and `is_attending_event` flags for UI customization
- ✅ Fallback feed respects purchased events (consistent behavior)
- ✅ All changes tested with linter (no errors)

**Next Steps:**
1. Run `npx supabase db push` to deploy SQL changes
2. Run `npx supabase functions deploy home-feed` to deploy edge function
3. Test in staging environment
4. Monitor metrics post-deployment
5. Iterate based on user feedback

---

Generated: November 7, 2025






