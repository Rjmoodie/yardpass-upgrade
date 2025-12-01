# 🔍 Tagged Posts Not Showing - Debug Guide

**Date:** November 27, 2025  
**Issue:** Tagged tab shows count (4) but no posts display

---

## 🚨 **Problem**

The "Tagged (4)" tab shows a count of 4 posts, but when clicked, displays "No posts yet" instead of showing the 4 tagged posts.

---

## 🔍 **Root Cause Analysis**

### **Count Query (Working ✅)**
```typescript
// EventDetailsPage.tsx - Lines 245-261
// Gets all posts, filters out organizer posts
const { data: allPosts } = await supabase
  .from('event_posts')
  .select('author_user_id')
  .eq('event_id', data.id);

const taggedPosts = (allPosts || []).filter(
  post => !memberIds.includes(post.author_user_id)
);
setTaggedCount(taggedPosts.length); // ✅ Shows 4
```

### **Display Query (Not Working ❌)**
```typescript
// EventPostsGrid.tsx - Uses Edge Function
// Calls: /functions/v1/posts-list?event_id=X&filter_type=attendee_only
// Edge Function filters by is_organizer flag
// Returns 0 posts instead of 4
```

---

## 🐛 **The Issue**

**Mismatch between count logic and display logic:**

1. **Count logic:** Directly queries `event_posts` and filters by `memberIds` from `org_memberships`
2. **Display logic:** Uses Edge Function which determines `is_organizer` based on:
   - `created_by` check
   - `owner_context_id` check  
   - `org_memberships` check

**Problem:** The Edge Function's `is_organizer` detection might be:
- Not correctly identifying organization members
- Missing some posts that should be tagged
- Filtering too aggressively

---

## ✅ **Fixes Applied**

### **1. Enhanced Debugging in Edge Function**

Added detailed logging to `enrichPosts` function:

```typescript
// supabase/functions/posts-list/index.ts
console.log(`✅ Post ${post.id}: Author is org member`);
console.log(`❌ Post ${post.id}: Author is NOT org member`);
```

**What this shows:**
- Which posts are being marked as organizer
- Which posts are being marked as attendee
- Why posts might be filtered out

### **2. Enhanced Debugging in EventPostsGrid**

Added console logs to track:
- How many posts received from Edge Function
- What `is_organizer` values are
- Client-side filtering results

### **3. Fixed Empty State Styling**

Changed empty state text colors from `text-white/60` to `text-foreground/60` for better visibility.

---

## 🔧 **How to Debug**

### **Step 1: Check Browser Console**

When you click the "Tagged" tab, look for:

```
[EventPostsGrid] Received X posts from Edge Function
[EventPostsGrid] Client-side filter: X → Y posts
```

### **Step 2: Check Edge Function Logs**

In Supabase Dashboard → Edge Functions → `posts-list` → Logs:

Look for:
```
🎯 Filter type requested: attendee_only
📊 Posts before filtering: X
🔍 attendee_only filter: X → Y posts
```

### **Step 3: Check Organizer Detection**

Look for logs like:
```
✅ Post {id}: Author is org member
❌ Post {id}: Author is NOT org member
```

---

## 🎯 **Expected Behavior**

### **For "Liventix Official" Event:**

1. **If event is organization-owned:**
   - Get all `org_memberships` for that org
   - Posts by those members = "Posts" tab
   - Posts by everyone else = "Tagged" tab

2. **If event is individual-owned:**
   - Posts by `created_by` = "Posts" tab
   - Posts by everyone else = "Tagged" tab

---

## 🔍 **Common Issues**

### **Issue 1: Organization Members Not Loaded**

**Symptom:** All posts marked as `is_organizer: false`

**Fix:** Check if `orgMembersMap` is populated:
```typescript
// In Edge Function logs, look for:
📊 Org memberships fetched for X orgs: Y total members
```

### **Issue 2: Event Data Missing**

**Symptom:** Posts have `is_organizer: false` even when they should be true

**Fix:** Check if event data is being fetched:
```typescript
// Look for:
⚠️ Post {id}: event data missing or incomplete
```

### **Issue 3: Client-Side Filter Too Aggressive**

**Symptom:** Edge Function returns posts, but client filters them all out

**Fix:** Check `orgMemberIds` in `EventPostsGrid`:
```typescript
// Should match the memberIds used in count query
```

---

## 📋 **Next Steps**

1. **Deploy Edge Function** with enhanced logging
2. **Check browser console** when clicking "Tagged" tab
3. **Check Edge Function logs** in Supabase Dashboard
4. **Compare:**
   - Count query `memberIds` vs Edge Function `orgMembersMap`
   - Count query results vs Edge Function results

---

## 🔗 **Related Files**

- `src/pages/new-design/EventDetailsPage.tsx` - Count query (lines 245-261)
- `src/components/EventPostsGrid.tsx` - Display component
- `supabase/functions/posts-list/index.ts` - Edge Function with filtering

---

**Last Updated:** November 27, 2025



