# Action Plan - Event Creation Fixes

## ✅ Completed

1. **AI Writing Assistant** - Edge Function updated and deployed
2. **Frontend Code** - EventCreator.tsx updated with:
   - Better idempotency protection
   - Permission validation before INSERT
   - RSVP-only checkbox for free tiers
   - Session tracking to prevent race conditions

## 🔧 Database Migrations to Apply

Run these SQL scripts in **Supabase SQL Editor** in order:

### Already Applied ✅
1. **`20250207000000_fix_events_view_permissions.sql`**
2. **`20250207000001_fix_ticket_tiers_view.sql`**

### Still Need to Apply ⏳

**3. Prevent Duplicate Events:**
```bash
# Run migration file:
# supabase/migrations/20250207000002_prevent_duplicate_events.sql
```
Or copy/paste this SQL:
```sql
-- Add unique constraint on slug
DO $$
BEGIN
  ALTER TABLE events.events 
  ADD CONSTRAINT events_slug_unique UNIQUE (slug);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint may already exist or duplicate slugs present';
END $$;
```

**4. Add RSVP Feature:**
```bash
# Run migration file:
# supabase/migrations/20250207000003_add_event_rsvps.sql
```
This creates:
- `events.event_rsvps` table
- `is_rsvp_only` column on `ticket_tiers`
- RLS policies for RSVPs
- Helper function `get_event_rsvp_count()`

## 🧹 Cleanup Duplicates

Run `CLEANUP_duplicate_events.sql` to delete the 3 duplicate events:

```sql
DELETE FROM events.events
WHERE id IN (
  'd31ccb95-1e38-47c0-966e-c58bece0f36c',
  '0cb8cd28-b725-413a-a651-a111dfd51063',
  '4b35c2ea-b45a-474b-892d-28e86ce47478'
);
```

Keep only: `45691a09-f1a9-4ab1-9e2f-e4e40e692960` (newest)

## 🧪 Testing

After applying migrations:

1. **Test Event Creation:**
   - Create a new event with tickets
   - Should succeed without 403/400 errors
   - Check no duplicates are created

2. **Test Free Tier RSVP:**
   - Create event with price = $0 tier
   - Check "RSVP only" checkbox appears
   - Enable it and create event
   - Verify `is_rsvp_only = true` in database

3. **Test Idempotency:**
   - Click "Create Event" button rapidly multiple times
   - Should only create ONE event

## 📋 Next: Implement RSVP Frontend Flow

Once migrations are applied, you'll need to:

1. Create RSVP button component for free/RSVP tiers
2. Show RSVP count on event pages
3. Handle RSVP submission to `event_rsvps` table
4. Display RSVP list to organizers

## 🎯 Quick Deploy Checklist

```bash
# 1. Apply migrations
# Option A: Run SQL files manually in Supabase SQL Editor
# Option B: Use Supabase CLI
npx supabase db push

# 2. Clean up duplicates (run SQL in editor)

# 3. Refresh your frontend (already updated)

# 4. Test event creation - should work! 🎉
```







