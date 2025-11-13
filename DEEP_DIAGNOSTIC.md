# 🔬 DEEP DIAGNOSTIC - Run ALL These Queries

Copy each SQL block and paste results back.

---

## Query 1: Check Table/View Structure

```sql
-- See ALL tickets/orders tables and views
SELECT 
  CASE 
    WHEN table_type = 'BASE TABLE' THEN '📊 TABLE'
    WHEN table_type = 'VIEW' THEN '👁️ VIEW'
  END as type,
  table_schema,
  table_name,
  (SELECT COUNT(*) 
   FROM information_schema.columns c 
   WHERE c.table_schema = t.table_schema 
     AND c.table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_name IN ('tickets', 'orders', 'order_items', 'ticket_tiers')
ORDER BY table_name, table_schema;
```

**Paste result here:**

---

## Query 2: Check Ticket Counts in BOTH Locations

```sql
-- Count tickets in actual table vs view
SELECT 
  'ticketing.tickets (REAL TABLE)' as location,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE created_at > now() - interval '2 hours') as recent_count,
  COUNT(*) FILTER (WHERE status = 'issued') as issued_count
FROM ticketing.tickets
UNION ALL
SELECT 
  'public.tickets (VIEW)' as location,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE created_at > now() - interval '2 hours') as recent_count,
  COUNT(*) FILTER (WHERE status = 'issued') as issued_count
FROM public.tickets;
```

**Paste result here:**

---

## Query 3: Check Recent Failed Orders

```sql
-- Find orders that should have tickets but don't
WITH recent_orders AS (
  SELECT 
    o.id,
    o.status,
    o.created_at,
    o.contact_email,
    o.user_id,
    (SELECT COUNT(*) FROM ticketing.order_items oi WHERE oi.order_id = o.id) as items_ordered,
    (SELECT SUM(quantity) FROM ticketing.order_items oi WHERE oi.order_id = o.id) as total_quantity
  FROM ticketing.orders o
  WHERE o.status = 'paid'
    AND o.created_at > now() - interval '2 hours'
)
SELECT 
  ro.id as order_id,
  ro.created_at::text,
  ro.status,
  ro.contact_email,
  ro.items_ordered,
  ro.total_quantity as should_have_tickets,
  (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.order_id = ro.id) as actual_tickets,
  CASE 
    WHEN (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.order_id = ro.id) = 0 THEN '❌ MISSING TICKETS'
    WHEN (SELECT COUNT(*) FROM ticketing.tickets t WHERE t.order_id = ro.id) < ro.total_quantity THEN '⚠️ PARTIAL'
    ELSE '✅ OK'
  END as status_check
FROM recent_orders ro
ORDER BY ro.created_at DESC;
```

**Paste result here:**

---

## Query 4: Check View Definition

```sql
-- See exactly what the public.tickets view does
SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE viewname = 'tickets'
  AND schemaname = 'public';
```

**Paste result here:**

---

## Query 5: Check Grants on Views

```sql
-- Check ALL grants on public.tickets
SELECT 
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'tickets'
ORDER BY grantee, privilege_type;
```

**Paste result here:**

---

## Query 6: Check if Functions Exist

```sql
-- Verify both required functions exist
SELECT 
  proname as function_name,
  pronargs as num_args,
  prorettype::regtype as return_type
FROM pg_proc 
WHERE proname IN ('claim_order_ticketing', 'gen_qr_code')
ORDER BY proname;
```

**Paste result here:**

---

## Query 7: Test Direct Insert (CRITICAL)

```sql
-- Try to insert a test ticket directly via view
DO $$
DECLARE
  v_test_order_id UUID := '3e0174c9-0984-4d38-b549-d83bb17d3ea3';
  v_test_ticket_id UUID := gen_random_uuid();
BEGIN
  -- Get order details
  DECLARE
    v_event_id UUID;
    v_tier_id UUID;
    v_user_id UUID;
  BEGIN
    SELECT event_id, user_id 
    INTO v_event_id, v_user_id
    FROM ticketing.orders 
    WHERE id = v_test_order_id;
    
    SELECT tier_id 
    INTO v_tier_id
    FROM ticketing.order_items 
    WHERE order_id = v_test_order_id 
    LIMIT 1;
    
    IF v_event_id IS NULL OR v_tier_id IS NULL THEN
      RAISE NOTICE '❌ Order not found or has no items';
      RETURN;
    END IF;
    
    -- Try INSERT via public.tickets view
    BEGIN
      INSERT INTO public.tickets (
        id, order_id, event_id, tier_id, status, owner_user_id, qr_code, created_at
      ) VALUES (
        v_test_ticket_id, v_test_order_id, v_event_id, v_tier_id, 'issued', v_user_id, 'TEST-' || substring(v_test_ticket_id::text, 1, 10), now()
      );
      
      RAISE NOTICE '✅ INSERT via public.tickets VIEW succeeded! Ticket ID: %', v_test_ticket_id;
      
      -- Clean up test ticket
      DELETE FROM ticketing.tickets WHERE id = v_test_ticket_id;
      RAISE NOTICE '🧹 Test ticket cleaned up';
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '❌ INSERT via public.tickets VIEW failed: % (Code: %)', SQLERRM, SQLSTATE;
    END;
  END;
END $$;
```

**Paste result here (look for ✅ or ❌ in NOTICES):**

---

## Query 8: Check Actual Tickets for Recent Orders

```sql
-- Show actual tickets created (if any)
SELECT 
  t.id as ticket_id,
  t.order_id,
  t.status,
  substring(t.qr_code, 1, 20) as qr_preview,
  t.created_at::text,
  o.contact_email
FROM ticketing.tickets t
JOIN ticketing.orders o ON o.id = t.order_id
WHERE t.created_at > now() - interval '2 hours'
ORDER BY t.created_at DESC
LIMIT 10;
```

**Paste result here:**

---

## 🧪 ALSO Run This Test

Run this script I created:

```bash
./TEST_ENSURE_TICKETS_DIRECTLY.sh
```

Or manually:

```bash
curl -v -X POST 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ensure-tickets' \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "3e0174c9-0984-4d38-b549-d83bb17d3ea3"}'
```

**Paste the FULL output including HTTP status code**

---

## 📋 What to Paste Back

Paste results for:
1. Query 1 (table/view structure)
2. Query 2 (ticket counts)
3. Query 3 (failed orders)
4. Query 5 (grants on public.tickets)
5. Query 6 (functions exist)
6. Query 7 (test insert - look for NOTICES)
7. Query 8 (actual tickets)
8. curl test output (full response with HTTP status)

**With this data, I'll pinpoint the exact issue!** 🔬


