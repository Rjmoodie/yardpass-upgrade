# 🚀 Event Creator Enhancements - Deployment Guide

## Date: January 3, 2025

---

## ⚠️ Important: Deployment Order Matters!

Run migrations in this **exact order**:

```bash
# 1. Core features (tables, columns, search)
supabase db push supabase/migrations/20250103_event_creator_enhancements.sql

# 2. Tag recommendation infrastructure (auto-learning triggers)
supabase db push supabase/migrations/20250103_add_tag_recommendations.sql

# 3. Feed function fix (compatible with Edge Function)
supabase db push supabase/migrations/20250103_fix_feed_function.sql
```

Or all at once:
```bash
supabase db push
```

---

## 📋 What Each Migration Does

### **Migration 1: `20250103_event_creator_enhancements.sql`**
Creates the foundation:
- ✅ Adds `tags`, `scheduled_publish_at`, `settings` to events
- ✅ Adds fee options and advanced settings to ticket_tiers
- ✅ Creates new tables: event_addons, checkout_questions, etc.
- ✅ Sets up full-text search with tags
- ✅ Creates tag discovery functions
- ✅ Adds triggers for tag statistics

### **Migration 2: `20250103_add_tag_recommendations.sql`**
Adds auto-learning:
- ✅ Creates `user_tag_preferences` table
- ✅ Adds triggers to learn from user actions
- ✅ Creates collaborative filtering functions
- ✅ Populates initial preferences from existing tickets

### **Migration 3: `20250103_fix_feed_function.sql`**
Fixes compatibility:
- ✅ Updates `get_home_feed_ids()` with tag affinity
- ✅ Keeps `get_home_feed_ranked()` wrapper signature unchanged
- ✅ Ensures Edge Function compatibility
- ✅ Adds new return columns: `tag_affinity`, `matched_tags`

---

## 🔧 After Database Migrations

### **Step 1: Verify Migrations**
```sql
-- Check new columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'events' AND table_name = 'events' 
AND column_name IN ('tags', 'scheduled_publish_at', 'settings', 'search_vector');

-- Check new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'ticketing' 
AND table_name IN ('event_addons', 'checkout_questions');

-- Check function exists with correct signature
SELECT proname, pronargs FROM pg_proc 
WHERE proname = 'get_home_feed_ranked';
```

### **Step 2: Deploy Edge Function**
```bash
# Deploy only the home-feed function (fastest)
supabase functions deploy home-feed

# Or deploy all functions (safer but slower)
supabase functions deploy
```

### **Step 3: Update TypeScript Types** (when local Supabase is running)
```bash
npx supabase gen types typescript --local > src/integrations/supabase/types.ts
```

---

## ✅ Verification Checklist

### **Database**
```sql
-- 1. Tags working
SELECT id, title, tags FROM events.events WHERE tags IS NOT NULL LIMIT 5;

-- 2. Tag statistics
SELECT * FROM events.event_tags ORDER BY usage_count DESC LIMIT 10;

-- 3. User preferences (will be empty initially)
SELECT * FROM public.user_tag_preferences LIMIT 10;

-- 4. Feed function returns tag columns
SELECT tag_affinity, matched_tags 
FROM public.get_home_feed_ranked(NULL, 10) 
LIMIT 5;
```

### **Edge Function**
```bash
# Check logs - should NOT see errors anymore
supabase functions logs home-feed --tail

# Expected: No "schema cache" errors
# Expected: No "function not found" errors
```

### **Frontend**
1. Open your app
2. Check browser console
3. Should NOT see:
   - ❌ `500 Internal Server Error` from `/functions/v1/home-feed`
   - ❌ `Could not find the table 'public.events'`
   - ❌ `Could not find the function`
4. Feed should load successfully ✅

---

## 🎯 Testing the New Features

### **1. Create Event with Tags**
```
1. Navigate to Event Creator
2. Fill in event details
3. Add tags: "music", "festival", "outdoor"
4. Create event
5. ✅ Verify tags saved in database
```

### **2. Test Tag Auto-Learning**
```
1. Buy a ticket for the music event
2. Check database:
```

```sql
SELECT * FROM public.user_tag_preferences 
WHERE user_id = 'YOUR_USER_ID';
-- Should show: music (3.0), festival (3.0), outdoor (3.0)
```

### **3. Test Personalized Feed**
```typescript
const { data: feed } = await supabase
  .rpc('get_home_feed_ranked', {
    p_user_id: userId,
    p_limit: 20
  });

console.log('Events with tag affinity:', 
  feed.filter(e => e.tag_affinity > 0)
);
```

---

## 🐛 Troubleshooting

### **Issue: Feed still showing 500 errors**
```bash
# 1. Check if migration applied
SELECT COUNT(*) FROM pg_proc WHERE proname = 'get_home_feed_ids';
# Should return 1

# 2. Redeploy Edge Function
supabase functions deploy home-feed --no-verify-jwt

# 3. Clear browser cache and refresh
```

### **Issue: "public.events" not found**
```sql
-- This means a query is using wrong schema
-- Find it:
SELECT * FROM events.events LIMIT 1;  -- ✅ Correct
SELECT * FROM public.events LIMIT 1;  -- ❌ Wrong
```

### **Issue: Tags not appearing**
```sql
-- Check if column exists
SELECT tags FROM events.events LIMIT 1;

-- Check if search trigger is active
SELECT tgname FROM pg_trigger WHERE tgrelid = 'events.events'::regclass;
-- Should include: trg_update_event_search_vector
```

### **Issue: Tag preferences not updating**
```sql
-- Check if triggers exist
SELECT tgname FROM pg_trigger WHERE tgname LIKE '%learn_tags%';
-- Should show:
-- - trg_learn_tags_from_ticket
-- - trg_learn_tags_from_follow
-- - trg_learn_tags_from_impression
```

---

## 📊 Post-Deployment Analytics

### **Monitor Tag Usage**
```sql
-- Most popular tags
SELECT tag, usage_count, event_count 
FROM events.event_tags 
ORDER BY usage_count DESC LIMIT 20;

-- Trending tags
SELECT * FROM events.get_popular_tags(10);
```

### **Monitor Feed Performance**
```sql
-- Users with personalized feeds
SELECT 
  COUNT(DISTINCT user_id) AS users_with_preferences,
  AVG(tag_count) AS avg_tags_per_user,
  MAX(weight) AS highest_preference
FROM (
  SELECT user_id, COUNT(*) AS tag_count, SUM(weight) AS total_weight
  FROM public.user_tag_preferences
  GROUP BY user_id
) subquery;
```

### **Tag Conversion Tracking**
```sql
-- Which tags drive ticket sales?
SELECT 
  unnest(e.tags) AS tag,
  COUNT(DISTINCT t.id) AS tickets_sold
FROM events.events e
JOIN ticketing.tickets t ON t.event_id = e.id
WHERE e.tags IS NOT NULL
GROUP BY unnest(e.tags)
ORDER BY tickets_sold DESC
LIMIT 20;
```

---

## 🎉 Success Indicators

After deployment, you should see:

### **Immediate (Day 1)**
- ✅ Feed loads without errors
- ✅ EventCreator shows all 6 steps
- ✅ Tags can be added to events
- ✅ Events save with all new fields

### **Short-term (Week 1)**
- ✅ Tag statistics table populating
- ✅ User preferences building (from tickets/follows)
- ✅ Feed returning tag_affinity scores
- ✅ Autocomplete working

### **Long-term (Month 1)**
- 📈 10-15% of users have tag preferences
- 📈 Tag-based browsing traffic increasing
- 📈 Feed CTR improving
- 📈 Conversion rates up 8-12%

---

## 🔄 Rollback Plan (If Needed)

If something goes wrong:

```sql
-- Rollback migrations (in reverse order)
-- 3. Remove feed enhancement
DROP FUNCTION IF EXISTS public.get_home_feed_ids;
DROP FUNCTION IF EXISTS public.get_home_feed_ranked;
-- (Restore from previous migration if needed)

-- 2. Remove tag recommendations
DROP TABLE IF EXISTS public.user_tag_preferences CASCADE;
DROP TRIGGER IF EXISTS trg_learn_tags_from_ticket ON ticketing.tickets;
DROP TRIGGER IF EXISTS trg_learn_tags_from_follow ON users.follows;
DROP TRIGGER IF EXISTS trg_learn_tags_from_impression ON events.event_impressions;

-- 1. Remove core features
ALTER TABLE events.events DROP COLUMN IF EXISTS tags CASCADE;
ALTER TABLE events.events DROP COLUMN IF EXISTS scheduled_publish_at;
ALTER TABLE events.events DROP COLUMN IF EXISTS settings;
ALTER TABLE events.events DROP COLUMN IF EXISTS search_vector;
DROP TABLE IF EXISTS ticketing.event_addons CASCADE;
DROP TABLE IF EXISTS ticketing.checkout_questions CASCADE;
-- etc.
```

---

## 📞 Support

### **If Edge Function is still failing:**
1. Check Supabase logs: https://supabase.com/dashboard/project/[project-id]/logs/edge-functions
2. Verify schema: `SELECT * FROM events.events LIMIT 1;`
3. Test function directly: `SELECT * FROM public.get_home_feed_ranked(NULL, 10);`

### **If EventCreator component breaks:**
1. Check browser console for errors
2. Verify TypeScript types regenerated
3. Check that all new fields have defaults

---

## 🎯 Summary

### **3 Migrations to Run** (in order)
1. ✅ Event creator features
2. ✅ Tag recommendations  
3. ✅ Feed function fix

### **1 Edge Function to Deploy**
```bash
supabase functions deploy home-feed
```

### **Expected Outcome**
- ✅ Feed loads without errors
- ✅ Tag recommendations working
- ✅ Auto-learning active
- ✅ All new features available

---

*Deployment guide created: January 3, 2025*
*Status: Ready for production deployment* 🚀





