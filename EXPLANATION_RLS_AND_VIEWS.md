# 🔒 RLS and Views - How They Interact

## 📚 **The Architecture**

```
┌─────────────────────────────────────────────────────┐
│                  Frontend/API                        │
│         Queries: .from("tickets")                    │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│          public.tickets (VIEW)                       │
│    SELECT * FROM ticketing.tickets WHERE...         │
│    ✅ Has GRANTs (SELECT, INSERT, UPDATE, DELETE)   │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│      ticketing.tickets (BASE TABLE)                  │
│    🔒 RLS ENABLED                                    │
│    📋 RLS Policies:                                  │
│      - tickets_insert_system_only: false ❌          │
│      - tickets_update_system_only: false ❌          │
│      - tickets_delete_system_only: false ❌          │
└─────────────────────────────────────────────────────┘
```

---

## ❌ **Why Inserts Are Failing**

### **The Flow:**

1. Edge Function (service_role): `INSERT INTO public.tickets ...`
2. View says: "✅ service_role has INSERT grant, proceed"
3. View executes: `INSERT INTO ticketing.tickets ...`
4. **RLS policy checks** (on base table):
   - Policy: `tickets_insert_system_only`
   - Check: `with_check: false`
   - Result: **❌ REJECT** (false = always reject)
5. INSERT fails, function crashes

### **Key Point:**

**Even though:**
- ✅ View has grants
- ✅ service_role has grants on table
- ✅ Edge Function uses service_role

**RLS policies are checked AFTER grants**, and RLS says "false" = reject everything.

---

## 🔓 **The Fix**

Change the RLS policy from:
```sql
-- OLD (broken)
CREATE POLICY "tickets_insert_system_only"
ON ticketing.tickets FOR INSERT
WITH CHECK (false);  -- ❌ Blocks ALL inserts
```

To:
```sql
-- NEW (fixed)
CREATE POLICY "tickets_insert_service_role"
ON ticketing.tickets FOR INSERT
WITH CHECK (
  auth.uid() IS NULL  -- ✅ Allow service_role (Edge Functions)
);
```

---

## 📊 **Double Counting - Possible Causes**

### **Theory 1: RLS Filtering**

When you query:
```sql
SELECT COUNT(*) FROM public.tickets;  -- As authenticated user
```

RLS might show:
- **474 tickets** (only YOUR tickets, filtered by RLS)

When system queries:
```sql
SELECT COUNT(*) FROM ticketing.tickets;  -- As service_role, bypasses RLS
```

Shows:
- **476 tickets** (ALL users' tickets)

### **Theory 2: Duplicate Ticket Records**

Some orders might have been partially processed, creating duplicate tickets.

### **Theory 3: Multiple Ticket Tables**

There might be tickets in different schemas that are being counted separately.

---

## 🔍 **Run This to Find Double Counting**

```sql
-- Compare counts as different roles
-- (Run in SQL Editor - you're logged in as authenticated user)

-- What YOU see (with RLS)
SELECT 'Your view (with RLS)' as source, COUNT(*) FROM public.tickets;

-- What service_role sees (bypasses RLS) - requires service_role query
-- Note: This might fail in SQL editor if not using service_role key

-- Check for duplicates
SELECT 
  order_id,
  COUNT(*) as tickets_per_order
FROM ticketing.tickets
GROUP BY order_id
HAVING COUNT(*) > 1;  -- Orders with multiple tickets
```

---

## 🎯 **Action Plan**

1. **Run RLS fix SQL** (see previous message)
2. **Check for duplicate tickets** (run query above)
3. **Test ensure-tickets again**
4. **Investigate double counting if still happening**

---

**Which query results do you want me to analyze for the double counting?** Paste the results from `/tmp/find_double_counting.sql` or let me know what numbers you're seeing (474 vs 476) and where.

