# 📊 Event Views Tracking - Current Implementation

**Date:** December 4, 2025  
**Status:** ⚠️ PARTIALLY IMPLEMENTED

---

## 🎯 How Views Are Currently Tracked

### **1. Frontend Tracking:**

**Hook:** `src/hooks/useInteractionTracking.ts`

```typescript
// Track view once per session per event
const trackViewOnce = async (eventId: string) => {
  if (cache[`${user.id}:${eventId}`]) return;  // Already viewed
  
  cache[`${user.id}:${eventId}`] = true;
  await trackInteraction(eventId, 'event_view', extra);
};
```

**Also:** `src/lib/internalAnalyticsTracker.ts`
```typescript
export async function trackEventView(eventId: string, props) {
  return trackInternalEvent({
    event_name: 'event_view',
    event_id: eventId,
    ...props
  });
}
```

---

### **2. Backend Storage:**

**Edge Function:** `supabase/functions/track-analytics/index.ts`

Views are stored in analytics tables (likely `analytics.events` or `post_views`).

---

### **3. Organizer Dashboard Display:**

**Current Status:** ⚠️ **STUBBED OUT**

```typescript
// src/components/OrganizerDashboard.tsx line 450
return {
  views: 0,  // ❌ Hardcoded to 0
  likes: 0,  // ❌ Hardcoded to 0
  shares: 0, // ❌ Hardcoded to 0
  revenue,   // ✅ Actual data
  attendees, // ✅ Actual data
};
```

**Issue:** Views are being TRACKED but not DISPLAYED in the dashboard!

---

## ❌ Why Organizer Dashboard Shows 0 Views

**In `OrganizerDashboard.tsx` line 450:**

```typescript
const transformed: Event[] = (data || []).map(e => {
  return {
    id: e.id,
    title: e.title,
    attendees,
    revenue,
    views: 0,        // ❌ HARDCODED
    likes: 0,        // ❌ HARDCODED
    shares: 0,       // ❌ HARDCODED
    tickets_sold,
    // ... other fields
  };
});
```

**The views are being tracked in the analytics system but NOT queried for the dashboard!**

---

## ✅ How to Fix It

### **Option 1: Query analytics.events table**

```typescript
// In fetchScopedEvents, add:
const { data: viewsData } = await supabase
  .from('analytics.events')
  .select('event_id')
  .in('event_id', eventIds)
  .eq('event_name', 'event_view');

// Group by event
const viewsByEvent = new Map();
viewsData?.forEach(view => {
  viewsByEvent.set(view.event_id, (viewsByEvent.get(view.event_id) || 0) + 1);
});

// Then in transform:
views: viewsByEvent.get(e.id) || 0,
```

---

### **Option 2: Use RPC function (better)**

```sql
-- Create function to get view counts
CREATE OR REPLACE FUNCTION get_event_view_counts(event_ids UUID[])
RETURNS TABLE (event_id UUID, view_count BIGINT)
AS $$
  SELECT 
    event_id,
    COUNT(*) as view_count
  FROM analytics.events
  WHERE event_id = ANY(event_ids)
    AND event_name = 'event_view'
  GROUP BY event_id;
$$ LANGUAGE sql STABLE;
```

```typescript
// Then in frontend:
const { data: views } = await supabase.rpc('get_event_view_counts', {
  event_ids: eventIds
});
```

---

### **Option 3: Add view_count column to events table (materialized)**

```sql
-- Add column
ALTER TABLE events.events ADD COLUMN view_count INTEGER DEFAULT 0;

-- Create trigger to increment on each view
CREATE FUNCTION increment_event_views() RETURNS TRIGGER AS $$
BEGIN
  UPDATE events.events SET view_count = view_count + 1
  WHERE id = NEW.event_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_event_view_increment
AFTER INSERT ON analytics.events
FOR EACH ROW
WHEN (NEW.event_name = 'event_view')
EXECUTE FUNCTION increment_event_views();
```

```typescript
// Then just query events table:
events.view_count  // Already there!
```

---

## 🎯 Recommendation

**For Now (Quick Fix):**
Leave views as 0 - they're not critical for launch

**For Next Sprint:**
Implement Option 3 (materialized column + trigger):
- ✅ Fastest (no joins)
- ✅ Real-time
- ✅ Automatic
- ✅ Works everywhere

---

## 📊 Current Tracking Status

| Metric | Tracked? | Stored? | Displayed? |
|--------|----------|---------|------------|
| **Event Views** | ✅ Yes | ✅ analytics.events | ❌ No (hardcoded 0) |
| **Post Views** | ✅ Yes | ✅ post_views | ✅ Yes |
| **Ticket Clicks** | ✅ Yes | ✅ analytics.events | ❌ No |
| **Checkouts** | ✅ Yes | ✅ analytics.events | ❌ No |
| **Revenue** | ✅ Yes | ✅ orders | ✅ Yes (just fixed!) |
| **Tickets Sold** | ✅ Yes | ✅ tickets | ✅ Yes (just fixed!) |

---

## 🚀 Quick Fix (If Needed)

**If you want to show views NOW, add to OrganizerDashboard.tsx:**

```typescript
// After fetching events, fetch view counts
const { data: analyticsData } = await supabase
  .from('analytics_events')  // Or wherever views are stored
  .select('event_id, event_name')
  .in('event_id', eventIds)
  .eq('event_name', 'event_view');

const viewsByEvent = new Map();
analyticsData?.forEach(a => {
  viewsByEvent.set(a.event_id, (viewsByEvent.get(a.event_id) || 0) + 1);
});

// Then:
views: viewsByEvent.get(e.id) || 0,
```

---

## ✅ Summary

**Views ARE being tracked** ✅  
**Views are NOT displayed** ❌ (hardcoded to 0)  
**Easy to fix** ✅ (add query to dashboard)  
**Priority:** LOW (revenue/tickets are more important)

---

**For now, focus on deploying the revenue/ticket fixes!** The views can be added later. 🚀

