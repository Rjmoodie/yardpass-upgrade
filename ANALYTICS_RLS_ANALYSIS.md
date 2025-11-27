# 🔍 Analytics Tables RLS Analysis

Based on codebase investigation, here's why analytics tables might not need RLS:

---

## 🎯 Key Finding: Analytics Tables Are Accessed via SECURITY DEFINER RPC Functions

### Access Pattern

**Clients access analytics through**:
1. **RPC Functions** (SECURITY DEFINER):
   - `get_audience_funnel_internal()` - SECURITY DEFINER ✅
   - `get_audience_funnel_cached()` - SECURITY DEFINER ✅
   - `get_analytics_with_comparison()` - SECURITY DEFINER ✅
   - `get_funnel_enhanced()` - SECURITY DEFINER ✅
   - All other analytics functions - SECURITY DEFINER ✅

2. **Views in `public` schema**:
   - `analytics_campaign_daily`
   - `analytics_creative_daily`
   - `analytics_viewability_campaign`
   - These views have their own access control

**Clients do NOT access**:
- ❌ Partitioned tables directly (`analytics_events_202505`, etc.)
- ❌ Raw analytics tables directly (`analytics.events`, etc.)

---

## 🔐 How Security Works

### SECURITY DEFINER Functions Bypass RLS

When an RPC function is `SECURITY DEFINER`, it:
- ✅ Runs as the function owner (usually `postgres` or `service_role`)
- ✅ **Bypasses all RLS policies**
- ✅ Can access all data regardless of RLS

**Example**:
```sql
CREATE FUNCTION public.get_audience_funnel_internal(...)
RETURNS JSONB
SECURITY DEFINER  -- ← This bypasses RLS!
AS $$
  -- Can query analytics.events directly, RLS doesn't apply
  SELECT * FROM analytics.events WHERE ...
$$;
```

### Access Control Inside RPC Functions

Security is enforced **inside the function**, not via RLS:

```sql
-- From get_audience_funnel_internal
-- Function checks org membership before returning data
IF NOT EXISTS (
  SELECT 1 FROM organizations.org_memberships om
  WHERE om.org_id = p_org_id
  AND om.user_id = auth.uid()
) THEN
  RAISE EXCEPTION 'Access denied';
END IF;
```

---

## 📊 Partitioned Tables Architecture

### How PostgreSQL Partitioning Works

When you create a partitioned table:

```sql
-- Parent table
CREATE TABLE analytics.events (...) PARTITION BY RANGE (ts);

-- Partitions automatically inherit:
-- ✅ RLS status from parent
-- ✅ Policies from parent (in PostgreSQL 11+)
-- ✅ Permissions from parent
```

**Key Point**: If the parent table has RLS enabled, partitions inherit it!

---

## 🤔 Why The Audit Shows RLS Disabled

### Possible Explanations:

1. **Partitions created before RLS was enabled on parent**
   - Partitions might have been created separately
   - They might not inherit RLS if created incorrectly

2. **Separate partition tables (not true partitions)**
   - Some "partition" tables might be standalone tables
   - Named like partitions but not actually partitioned

3. **RLS on parent, but grants still allow direct access**
   - Even with RLS, if grants exist, clients can query
   - RLS policies would then filter results

4. **Designed to be accessed only via SECURITY DEFINER functions**
   - Tables intentionally have no RLS
   - Security enforced in RPC functions
   - Grants allow access, but RPC functions control what's returned

---

## ✅ Recommended Approach

### Option 1: Keep Current Design (If Intentional)

**If analytics tables are meant to be accessed ONLY via RPC functions**:
- ✅ Keep RLS disabled on partitioned tables
- ✅ Ensure all RPC functions are SECURITY DEFINER
- ✅ Verify RPC functions enforce access control internally
- ✅ Revoke direct grants to partitioned tables (keep parent grants)

**Pros**:
- ✅ Performance (no RLS overhead on partitioned tables)
- ✅ Simpler security model (all logic in RPC functions)

**Cons**:
- ⚠️ Defense in depth: If someone bypasses RPC, they get full access
- ⚠️ Less explicit (grants suggest direct access is allowed)

### Option 2: Enable RLS (Defense in Depth)

**Enable RLS on parent tables (cascades to partitions)**:
- ✅ Parent table RLS policies apply to all partitions
- ✅ Defense in depth (even if RPC bypassed, RLS protects)
- ✅ More explicit security model

**Pros**:
- ✅ Defense in depth
- ✅ Explicit security model
- ✅ Aligns with best practices

**Cons**:
- ⚠️ Minimal performance impact on partitioned tables
- ⚠️ RPC functions bypass RLS anyway (so redundant, but safer)

---

## 🔍 Verification Needed

Run this query to verify the architecture:

```sql
-- Check if partitions actually inherit from parent
SELECT 
    c.relname as partition_name,
    p.relname as parent_table,
    CASE 
        WHEN i.inhrelid IS NOT NULL THEN '✅ True partition (inherits RLS)'
        ELSE '❌ Standalone table (needs own RLS)'
    END as partition_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_inherits i ON i.inhrelid = c.oid
LEFT JOIN pg_class p ON p.oid = i.inhparent
WHERE n.nspname = 'analytics'
    AND (
        c.relname LIKE 'analytics_events_%'
        OR c.relname LIKE 'event_impressions_p%'
        OR c.relname LIKE 'ticket_analytics_p%'
    )
ORDER BY parent_table, partition_name;
```

---

## 🎯 Recommendation

**If partitions inherit from parent**:
- ✅ Check if parent has RLS enabled
- ✅ If yes, partitions are already secure
- ✅ Revoke grants on partitioned tables for defense in depth

**If partitions are standalone**:
- ✅ Enable RLS on each partition
- ✅ OR keep current design if all access is via SECURITY DEFINER RPC

**Key Question**: Are these tables queried directly by clients, or only through RPC functions?

---

**Next Step**: Run the verification query to understand the partition architecture


