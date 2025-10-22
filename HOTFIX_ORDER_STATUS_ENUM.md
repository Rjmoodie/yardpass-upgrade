# Hotfix: Migration Syntax Corrections

## Issue 1: Order Status Enum
The initial migrations incorrectly used `'fulfilled'` as an order status value, which is not part of the `order_status` enum.

## Issue 2: pg_cron Schedule Syntax
The `cron.schedule` calls used nested `$$` delimiters which caused syntax errors in PostgreSQL.

## Valid order_status Values
According to the schema, the valid values are:
- `'pending'` (default)
- `'paid'`
- `'cancelled'`
- `'refunded'`

## Files Fixed

### 1. `supabase/migrations/20251021_0002_sponsorship_views.sql`
**Changed:**
- Line 17: `o.status IN ('paid','fulfilled')` → `o.status = 'paid'`
- Line 43: `o.status IN ('paid','fulfilled')` → `o.status = 'paid'`

### 2. `supabase/migrations/20251021_0110_quality_score_view.sql`
**Changed:**
- Line 17: `o.status IN ('paid', 'fulfilled')` → `o.status = 'paid'`

## Impact
- **Low**: Only affects view definitions
- **No data loss**: Views are read-only
- **Semantic meaning unchanged**: Orders with `status = 'paid'` represent completed purchases

## Verification
```sql
-- Check order status distribution
SELECT status, COUNT(*) 
FROM orders 
GROUP BY status;

-- Verify views work correctly
SELECT * FROM v_event_performance_summary LIMIT 1;
SELECT * FROM v_event_quality_score LIMIT 1;
```

## Status
✅ **Fixed** - All migrations now use correct enum values

---

**Applied:** October 21, 2025  
**Severity:** Low  
**Type:** Schema validation error

