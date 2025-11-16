# 🔍 Debug Ticket Generation Issue

**Status:** Function deployed but still failing

---

## Step 1: Check Actual Error in ensure-tickets Logs

Run this command to see the real error:

```bash
supabase functions logs ensure-tickets --tail
```

Then make a test purchase and watch for errors.

**Look for these common errors:**

### Error 1: "Lock failed" or "claim_order_ticketing"
```
Lock failed: function public.claim_order_ticketing does not exist
```

**Fix:** Run this in Supabase SQL Editor:
```sql
-- Check if function exists
SELECT proname FROM pg_proc WHERE proname = 'claim_order_ticketing';

-- If missing, create it
CREATE OR REPLACE FUNCTION public.claim_order_ticketing(p_order_id UUID)
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT pg_try_advisory_xact_lock(
    ('x' || substr(replace($1::text,'-',''),1,8))::bit(32)::int,
    ('x' || substr(replace($1::text,'-',''),9,8))::bit(32)::int
  );
$$;
```

---

### Error 2: "Missing tier" or "tier_id"
```
Missing tier [UUID] for order_item [UUID]
```

**Cause:** Order items reference ticket_tiers that don't exist

**Check:**
```sql
-- Find orders with missing tiers
SELECT 
  oi.id as order_item_id,
  oi.order_id,
  oi.tier_id,
  CASE 
    WHEN tt.id IS NULL THEN '❌ MISSING TIER'
    ELSE '✅ OK'
  END as tier_status
FROM order_items oi
LEFT JOIN ticket_tiers tt ON tt.id = oi.tier_id
WHERE oi.order_id IN (
  SELECT id FROM orders 
  WHERE status = 'paid' 
    AND created_at > now() - interval '2 hours'
)
ORDER BY oi.created_at DESC;
```

---

### Error 3: "gen_qr_code() does not exist"
```
function gen_qr_code() does not exist
```

**Fix:** Run this in Supabase SQL Editor:
```sql
-- Check if function exists
SELECT proname FROM pg_proc WHERE proname = 'gen_qr_code';

-- If missing, create it
CREATE OR REPLACE FUNCTION public.gen_qr_code()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  -- Generate 20-character alphanumeric QR code
  RETURN upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10) || 
               substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));
END;
$$;
```

---

### Error 4: RLS Policy Blocking
```
new row violates row-level security policy for table "tickets"
```

**Fix:** Run this in Supabase SQL Editor:
```sql
-- Check RLS policies on tickets table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'tickets';

-- Temporarily disable RLS for service role (if not already)
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;

-- Ensure service role can insert
CREATE POLICY IF NOT EXISTS "Service role can insert tickets"
ON tickets
FOR INSERT
TO service_role
WITH CHECK (true);
```

---

### Error 5: Schema Mismatch (ticketing vs public)
```
relation "tickets" does not exist
```

**Cause:** Tickets table might be in `ticketing` schema, not `public`

**Check:**
```sql
-- Find tickets table
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename = 'tickets';
```

**Fix in ensure-tickets function:**
If tickets are in `ticketing` schema, change line 69 from:
```typescript
.from("tickets")
```
to:
```typescript
.from("ticketing.tickets")
```

---

## Step 2: Test ensure-tickets Directly

Get a recent paid order ID and test the function directly:

```sql
-- Get a recent paid order
SELECT id FROM orders 
WHERE status = 'paid' 
  AND created_at > now() - interval '2 hours'
ORDER BY created_at DESC 
LIMIT 1;
```

Copy the order ID, then test:

```bash
curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "PASTE_ORDER_ID_HERE"}'
```

**Expected successful response:**
```json
{
  "status": "issued",
  "issued": 1,
  "rsvp_count": 0
}
```

**If you get an error, paste it here and we'll fix it.**

---

## Step 3: Check Deployment Timestamp

Verify the function actually deployed:

```bash
# List all functions and their deployment times
supabase functions list
```

Look for `ensure-tickets` and check the timestamp is recent (within last 10 minutes).

**Or check in Dashboard:**
1. Go to: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/functions
2. Click `ensure-tickets`
3. Check "Last deployed" timestamp

---

## Step 4: Force Redeploy

If timestamp is old, force a new deployment:

```bash
cd /Users/rod/Desktop/yard_pass/liventix/liventix-upgrade/liventix-upgrade

# Force redeploy
supabase functions deploy ensure-tickets --no-verify-jwt --project-ref yieslxnrfeqchbcmgavz
```

---

## Step 5: Check Environment Variables

Ensure these are set in Supabase:

```bash
supabase secrets list
```

**Required:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `RESEND_API_KEY` (for emails)

**If missing, set them:**
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_key_here
supabase secrets set RESEND_API_KEY=re_your_key_here
```

---

## Step 6: Check Database Schema

Verify all required tables and columns exist:

```sql
-- Check tickets table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'tickets'
ORDER BY ordinal_position;

-- Check required columns exist
SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'order_id') THEN '✅' ELSE '❌' END as has_order_id,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'event_id') THEN '✅' ELSE '❌' END as has_event_id,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'tier_id') THEN '✅' ELSE '❌' END as has_tier_id,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'qr_code') THEN '✅' ELSE '❌' END as has_qr_code,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'status') THEN '✅' ELSE '❌' END as has_status,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'owner_user_id') THEN '✅' ELSE '❌' END as has_owner_user_id;
```

All should show `✅`. If any show `❌`, the table schema is wrong.

---

## Step 7: Enable Detailed Logging

Add more logging to see exactly where it's failing:

**Check Supabase logs in real-time:**

1. Go to: https://supabase.com/dashboard/project/yieslxnrfeqchbcmgavz/logs/edge-functions
2. Filter by function: `ensure-tickets`
3. Click on the most recent error
4. Look for the full error message

**Common log messages and what they mean:**

| Log Message | Meaning | Action |
|-------------|---------|--------|
| `[ENSURE-TICKETS] start` | Function started successfully | ✅ Good |
| `[ENSURE-TICKETS] already issued` | Tickets already exist (idempotent) | ✅ Good |
| `Order lookup failed` | Can't find order in database | Check order_id is correct |
| `Lock failed` | Database function missing | Create `claim_order_ticketing` |
| `Load items failed` | Can't find order_items | Check order has items |
| `Missing tier` | Tier doesn't exist | Check ticket_tiers table |
| `Insert tickets failed` | Can't create tickets | Check RLS policies, schema |
| `Capacity errors` | Event sold out | Expected behavior |

---

## Step 8: Manual Ticket Creation (Last Resort)

If all else fails, create tickets manually:

```sql
-- For a specific order, create tickets manually
WITH order_details AS (
  SELECT 
    o.id as order_id,
    o.user_id,
    o.event_id,
    oi.tier_id,
    oi.quantity
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE o.id = 'PASTE_ORDER_ID_HERE'
)
INSERT INTO tickets (order_id, event_id, tier_id, status, owner_user_id, qr_code, created_at)
SELECT 
  order_id,
  event_id,
  tier_id,
  'issued' as status,
  user_id as owner_user_id,
  public.gen_qr_code() as qr_code,
  now() as created_at
FROM order_details
CROSS JOIN generate_series(1, (SELECT quantity FROM order_details)) as n;

-- Verify tickets were created
SELECT COUNT(*) as ticket_count
FROM tickets
WHERE order_id = 'PASTE_ORDER_ID_HERE';
```

---

## Quick Checklist

Run through this checklist and report back which step fails:

- [ ] `ensure-tickets` function deployed (check timestamp)
- [ ] `claim_order_ticketing` function exists in database
- [ ] `gen_qr_code` function exists in database
- [ ] `tickets` table exists and has correct columns
- [ ] RLS policies allow service_role to insert tickets
- [ ] Environment variables are set (STRIPE_SECRET_KEY, etc.)
- [ ] Recent order exists with `status = 'paid'`
- [ ] Order has `order_items` records
- [ ] All `order_items` reference valid `ticket_tiers`
- [ ] Direct test of ensure-tickets API succeeds

---

## What to Share with Me

To help debug, paste:

1. **Error message from logs:**
   ```
   [Paste the exact error from Supabase logs here]
   ```

2. **Result of this query:**
   ```sql
   SELECT 
     o.id as order_id,
     o.status,
     (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as items,
     (SELECT COUNT(*) FROM tickets t WHERE t.order_id = o.id) as tickets
   FROM orders o
   WHERE o.created_at > now() - interval '1 hour'
   ORDER BY o.created_at DESC
   LIMIT 1;
   ```

3. **Result of direct API test:**
   ```bash
   curl -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"order_id": "YOUR_ORDER_ID"}'
   ```

With this info, I can pinpoint the exact issue.



