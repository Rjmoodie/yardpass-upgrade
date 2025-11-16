# 🔍 Get ensure-tickets Actual Error

The logs show `process-payment` is calling `ensure-tickets` but it's returning a **non-2xx status code**. We need to see what `ensure-tickets` itself is logging.

---

## Option 1: Check Supabase Dashboard (Easiest)

1. Go to: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/logs/edge-functions
2. **Filter by function:** `ensure-tickets`  
3. **Time range:** Last 1 hour
4. Look for the most recent error (timestamp around `1762868939158000` = your most recent purchase)

**Look for logs like:**
- `[ENSURE-TICKETS] start` (if it started)
- `Lock failed: ...` (if claim_order_ticketing failed)
- `Count failed: ...` (if tickets table query failed)
- `Load items failed: ...` (if order_items query failed)
- `Missing tier ...` (if ticket_tiers don't exist)
- `Insert tickets failed: ...` (if ticket creation failed)

---

## Option 2: CLI Command

```bash
supabase functions logs ensure-tickets --limit 50
```

Look for errors in the output.

---

## Option 3: Test Directly and See Error

Run this in your terminal with a real order ID:

```bash
curl -v -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "ba1eff01-8955-4136-b4af-39161aaebda8"}'
```

The `-v` flag will show the full response including HTTP status code and error body.

---

## Likely Causes (Based on Your Logs)

### 1. **View Issue** (Most Likely)

Run this in Supabase SQL Editor to check:

```sql
-- Check if tickets, order_items, orders are tables or views
SELECT 
  schemaname,
  tablename as name,
  'table' as type
FROM pg_tables 
WHERE tablename IN ('tickets', 'order_items', 'orders', 'ticket_tiers')
UNION ALL
SELECT 
  schemaname,
  viewname as name,
  'view' as type
FROM pg_views 
WHERE viewname IN ('tickets', 'order_items', 'orders', 'ticket_tiers')
ORDER BY name, schemaname;
```

**If `tickets` shows up as a VIEW instead of a TABLE:**
- That's the problem! Views can't be inserted into by edge functions (same as the checkout_sessions issue)
- The fix is to point `ensure-tickets` to the actual table schema

### 2. **Schema Mismatch**

`ensure-tickets` queries `.from("tickets")` which defaults to `public.tickets`, but the actual table might be in `ticketing.tickets`.

Check with:
```sql
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename = 'tickets';
```

If it returns `ticketing` schema, we need to update the function to use `ticketing.tickets`.

### 3. **RLS Policy Blocking**

Service role might not have permission to insert tickets.

Check with:
```sql
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename = 'tickets' AND cmd = 'INSERT';
```

If there's no policy allowing `service_role`, add one:
```sql
CREATE POLICY "Service role can insert tickets"
ON tickets FOR INSERT
TO service_role
WITH CHECK (true);
```

---

## Quick Diagnostic Query

Run this to see the order and what's missing:

```sql
WITH order_check AS (
  SELECT 
    o.id as order_id,
    o.status as order_status,
    o.user_id,
    o.event_id,
    (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as order_items_count,
    (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id) as tickets_count,
    -- Check if all tiers exist
    (SELECT COUNT(*) 
     FROM order_items oi 
     LEFT JOIN ticket_tiers tt ON tt.id = oi.tier_id 
     WHERE oi.order_id = o.id AND tt.id IS NULL) as missing_tiers_count
  FROM orders o
  WHERE o.id = 'ba1eff01-8955-4136-b4af-39161aaebda8'
)
SELECT 
  *,
  CASE 
    WHEN order_items_count = 0 THEN '❌ No order items'
    WHEN missing_tiers_count > 0 THEN '❌ Missing ticket tiers'
    WHEN tickets_count > 0 THEN '✅ Tickets exist'
    ELSE '⚠️ Ready to create tickets'
  END as diagnosis
FROM order_check;
```

---

## What to Paste Back

After running one of the above, paste:

1. **The actual error from ensure-tickets logs** (Option 1 or 2)
2. **Result of the curl command** (Option 3)
3. **Result of the table/view check query**
4. **Result of the diagnostic query**

With that, I can pinpoint the exact fix needed!



