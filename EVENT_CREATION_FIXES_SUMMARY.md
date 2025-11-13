# Event Creation Fixes - Summary

## Issues Fixed

### 1. AI Writing Assistant - 400 Error ✅ DEPLOYED
**Problem:** Frontend was calling `action: 'generate_title'` but Edge Function didn't have that action  
**Fix:** Added `generate_title` action to `supabase/functions/ai-writing-assistant/index.ts`  
**Status:** ✅ Deployed

### 2. Events - 403 Forbidden Error ✅ FIXED
**Problem:** `public.events` view only had SELECT permission  
**Root Cause:** View missing INSERT, UPDATE, DELETE grants  
**Fix:** Migration `20250207000000_fix_events_view_permissions.sql`  
**SQL Applied:**
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
```
**Status:** ✅ Applied in database

### 3. Ticket Tiers - 400 Missing Column Error ✅ FIXED
**Problem:** `public.ticket_tiers` view was missing `fee_bearer`, `tier_visibility`, `requires_tier_id` columns  
**Root Cause:** View created before columns were added to underlying `ticketing.ticket_tiers` table  
**Fix:** Migration `20250207000001_fix_ticket_tiers_view.sql`  
**Status:** ✅ Applied in database

### 4. Duplicate Event Creation ✅ IMPROVED
**Problem:** Same event created 4 times (double-click + retry behavior)  
**Fix Applied:**
- Improved duplicate submission protection with session tracking
- Added `submittingRef.current` check to button disable logic
- Added database unique constraint on `slug` column

**Files Changed:**
- `src/components/EventCreator.tsx` - Better idempotency logic
- Migration `20250207000002_prevent_duplicate_events.sql` - Unique slug constraint

**Cleanup Needed:**
- Run `CLEANUP_duplicate_events.sql` to delete the 3 duplicate "Ultimate Soccer Tailgate Experience" events

### 5. Free Tier RSVP Feature ✅ IMPLEMENTED
**Request:** Free tiers should allow RSVP for headcount without issuing tickets  
**Implementation:**
- Added `is_rsvp_only` boolean flag to `ticketing.ticket_tiers`
- Created `events.event_rsvps` table for RSVP tracking
- Added UI checkbox that appears when tier price = $0
- Created helper function `get_event_rsvp_count(event_id)` for analytics

**Files Changed:**
- `src/components/EventCreator.tsx` - UI checkbox and data handling
- Migration `20250207000003_add_event_rsvps.sql` - Database schema

## Migrations to Apply

Run these in order (or use `npx supabase db push`):

1. ✅ **`20250207000000_fix_events_view_permissions.sql`** - Already applied
2. ✅ **`20250207000001_fix_ticket_tiers_view.sql`** - Already applied
3. ⏳ **`20250207000002_prevent_duplicate_events.sql`** - Run to add unique constraint
4. ⏳ **`20250207000003_add_event_rsvps.sql`** - Run to add RSVP feature

## Files That Handle Event Creation

### Frontend:
1. **`src/components/EventCreator.tsx`** (lines 487-743)
   - Main event creation form and submission logic
   - Handles validation, tickets, add-ons, checkout questions

2. **`src/components/CreateEventFlow.tsx`** (lines 28-389)
   - Organization selection
   - Routes to EventCreator with selected org

3. **`src/hooks/useSeriesCreation.ts`** (lines 61-100)
   - Creates multiple recurring events via RPC

### Database:
- **Table:** `events.events` (accessed via `public.events` view)
- **RLS Policy:** `events_insert_owner_or_editor` - Requires editor/admin/owner role
- **View:** `public.events` - Now has full INSERT/UPDATE/DELETE permissions

## Next Steps

1. **Clean up duplicates:**
   - Run `CLEANUP_duplicate_events.sql` (uncomment the DELETE statement)

2. **Apply remaining migrations:**
   ```sql
   -- Run in Supabase SQL Editor:
   -- Migration 20250207000002 (unique constraint)
   -- Migration 20250207000003 (RSVP feature)
   ```

3. **Test event creation:**
   - Try creating a new event
   - Should work without 403 or 400 errors
   - Free tiers should show RSVP checkbox

4. **Implement RSVP frontend:**
   - Create RSVP button component
   - Add RSVP count display on event cards
   - Handle RSVP submission flow

## Key Learnings

⚠️ **Always check if frontend is querying a VIEW when debugging database errors!**
- Views need explicit GRANT permissions for INSERT/UPDATE/DELETE
- Views created before schema changes won't include new columns
- Check with: `SELECT * FROM pg_views WHERE viewname = 'table_name'`






