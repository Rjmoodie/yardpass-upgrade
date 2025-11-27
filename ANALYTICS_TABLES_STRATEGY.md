# 📊 Analytics Tables Strategy - RLS Decision Guide

Based on the audit, we have **60+ analytics partitioned tables** without RLS. Here's how to handle them:

---

## 🤔 Decision Framework

### Question 1: Are these tables accessible to clients?

**Check**: Run `20250128_check_analytics_grants.sql` to see if `anon`/`authenticated` have grants.

**If NO grants to anon/authenticated**:
- ✅ **No RLS needed** - These are backend-only
- ✅ **Document as "service-role only"**
- ✅ **No action required**

**If YES grants exist**:
- ❌ **Action required** - Choose Option A or B below

---

## 🎯 Options for Client-Accessible Analytics Tables

### Option A: Enable RLS with Service-Role-Only Policies (Recommended)

**Strategy**: Enable RLS, add deny-all policies, only service-role can access

**Pros**:
- ✅ Explicit security model
- ✅ Prevents accidental client access
- ✅ Clear intent in database

**Cons**:
- ⚠️ Need to enable RLS on 60+ partitioned tables
- ⚠️ PostgreSQL partitioned table RLS can be tricky

**SQL Pattern**:
```sql
-- Enable RLS on parent table (cascades to partitions)
ALTER TABLE analytics.analytics_events ENABLE ROW LEVEL SECURITY;

-- Deny-all policy (only service_role can access)
CREATE POLICY "analytics_events_service_role_only"
ON analytics.analytics_events
FOR ALL
USING (false)  -- Deny all
WITH CHECK (false);

-- Service-role bypasses RLS anyway, so this just makes intent explicit
```

---

### Option B: Revoke Grants (Alternative)

**Strategy**: Revoke all grants to `anon`/`authenticated`, keep RLS disabled

**Pros**:
- ✅ Simpler (no RLS policies needed)
- ✅ Faster to implement

**Cons**:
- ⚠️ Less explicit (grants could be accidentally re-added)
- ⚠️ RLS is generally preferred over grant-based security

**SQL Pattern**:
```sql
-- Revoke all grants from client roles
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'analytics'
        AND (
            tablename LIKE 'analytics_events_%'
            OR tablename LIKE 'event_impressions_p%'
            OR tablename LIKE 'ticket_analytics_p%'
        )
    LOOP
        EXECUTE format('REVOKE ALL ON analytics.%I FROM anon, authenticated', tbl);
    END LOOP;
END $$;
```

---

## 🎯 Recommendation

**If tables are already service-role only (no grants)**:
- ✅ **No action needed**
- ✅ Document in `AUDIT_CONTEXT_REFERENCE.md` as intentionally service-role only

**If tables have client grants**:
- ✅ **Recommend Option A** (Enable RLS with deny-all)
- ✅ More explicit and secure
- ✅ Follows best practices

---

## 📋 Implementation Steps

1. **Run grants check**: `20250128_check_analytics_grants.sql`
2. **If no grants**: Document as "intentional - service-role only"
3. **If grants exist**: 
   - Create migration with Option A or B
   - Test with service-role access
   - Verify client access is blocked
   - Deploy

---

## 🔍 What We Found

From the audit:
- **32 analytics tables** total
- **2 have RLS enabled** (good!)
- **30 don't have RLS** (mostly partitioned tables)

**Likely Scenario**: These partitioned tables are already service-role only (no grants), so they don't need RLS. But we should verify!

---

**Next Step**: Run the grants check query to confirm.


