# ✅ Analytics Tables RLS Decision

## 🔍 Key Findings from Query Results

### 1. **Partition Architecture** ✅
- All partitions are **true partitions** (inherit from parent)
- Partitions automatically inherit RLS status from parent table
- Partitions cannot have independent RLS (PostgreSQL design)

### 2. **Parent Table RLS Status**
| Parent Table | RLS Status | Partitions Affected |
|--------------|-----------|-------------------|
| `analytics.events` | ✅ **RLS Enabled** | ~8 partitions (analytics_events_202505-202512) |
| `event_impressions_p` | ❌ **RLS Disabled** | ~20 partitions (event_impressions_p_202404-202511) |
| `ticket_analytics_p` | ❌ **RLS Disabled** | ~20 partitions (ticket_analytics_p_202404-202511) |

### 3. **Access Pattern Analysis**
**✅ Primary Access**: SECURITY DEFINER RPC Functions (bypass RLS)
- All analytics functions are `SECURITY DEFINER`
- Functions enforce access control internally
- Functions can access data regardless of RLS

**⚠️ Secondary Access**: Direct Queries (need RLS protection)
Found in codebase:
- `src/lib/internalAnalyticsTracker.ts` - `.from('analytics.events')` INSERT ✅ (allowed by RLS policy)
- `src/components/analytics/DrillthroughModal.tsx` - `.from('analytics.events')` SELECT ⚠️ (needs RLS)
- `src/hooks/useAudienceIntelligence.ts` - `.from('analytics.audience_segments')` ⚠️
- `src/hooks/useAnalyticsQuery.ts` - `.from('analytics.saved_views')` ⚠️

---

## 🎯 Recommendation

### **Option 1: Keep Current Design (RPC-Only Access)** ⭐ **RECOMMENDED**

**If analytics tables are meant to be accessed ONLY via RPC functions:**

1. ✅ **Keep RLS disabled** on partitioned parent tables
   - `event_impressions_p` - Keep RLS disabled
   - `ticket_analytics_p` - Keep RLS disabled
   - `analytics.events` - Already has RLS enabled (good for direct INSERT)

2. ✅ **Revoke direct grants** to partitioned tables for defense in depth
   ```sql
   REVOKE SELECT ON ALL TABLES IN SCHEMA analytics FROM anon, authenticated
   WHERE tablename LIKE 'analytics_events_%'
      OR tablename LIKE 'event_impressions_p%'
      OR tablename LIKE 'ticket_analytics_p%';
   ```

3. ✅ **Remove direct queries from frontend**
   - Update `DrillthroughModal.tsx` to use RPC function instead
   - Update `useAudienceIntelligence.ts` to use RPC functions
   - Keep `internalAnalyticsTracker.ts` INSERT (already has RLS policy)

**Pros**:
- ✅ Simpler security model (all logic in RPC functions)
- ✅ No RLS overhead on partitioned tables
- ✅ Consistent access pattern
- ✅ Single source of truth for access control

**Cons**:
- ⚠️ Requires code changes to remove direct queries
- ⚠️ Less defense in depth (but RPC functions are the primary access)

---

### **Option 2: Enable RLS (Defense in Depth)**

**If you want to keep direct queries as-is:**

1. ✅ Enable RLS on parent tables (cascades to partitions)
   ```sql
   ALTER TABLE analytics.event_impressions_p ENABLE ROW LEVEL SECURITY;
   ALTER TABLE analytics.ticket_analytics_p ENABLE ROW LEVEL SECURITY;
   ```

2. ✅ Create RLS policies (org-scoped access)
   ```sql
   CREATE POLICY "Users can view impressions for their orgs"
     ON analytics.event_impressions_p FOR SELECT TO authenticated
     USING (
       EXISTS (
         SELECT 1 FROM organizations.org_memberships om
         WHERE om.org_id = (SELECT org_id FROM events.events WHERE id = event_impressions_p.event_id)
         AND om.user_id = auth.uid()
       )
     );
   ```

**Pros**:
- ✅ Defense in depth (even if RPC bypassed, RLS protects)
- ✅ Supports direct queries from frontend
- ✅ More explicit security model

**Cons**:
- ⚠️ RLS overhead on partitioned tables (minimal, but exists)
- ⚠️ More complex policies to maintain
- ⚠️ Redundant if all access is via SECURITY DEFINER RPC

---

## 🚀 **Recommended Action Plan**

### **Phase 1: Secure Current State (No Code Changes)**

```sql
-- Revoke direct access to partitioned tables (defense in depth)
REVOKE SELECT ON analytics.event_impressions_p FROM anon, authenticated;
REVOKE SELECT ON analytics.ticket_analytics_p FROM anon, authenticated;

-- Keep INSERT for event tracking (already has RLS on analytics.events)
-- Keep RPC function access (SECURITY DEFINER bypasses RLS anyway)
```

### **Phase 2: Remove Direct Queries (Optional)**

Update frontend to use RPC functions instead:
- `DrillthroughModal.tsx` → Create `get_drillthrough_data()` RPC
- `useAudienceIntelligence.ts` → Use existing RPC functions
- Keep `internalAnalyticsTracker.ts` INSERT as-is

---

## ✅ **Final Verdict**

**Analytics partitioned tables DO NOT need RLS IF**:
- ✅ All access is via SECURITY DEFINER RPC functions (which it is)
- ✅ Direct grants are revoked (defense in depth)
- ✅ Direct queries are removed from frontend (optional, but cleaner)

**Current Status**:
- `analytics.events` has RLS ✅ (good for INSERT tracking)
- `event_impressions_p` has RLS disabled ⚠️ (but accessed via RPC, so OK)
- `ticket_analytics_p` has RLS disabled ⚠️ (but accessed via RPC, so OK)

**Action**: Revoke direct grants on partitioned tables, keep current RLS design.


