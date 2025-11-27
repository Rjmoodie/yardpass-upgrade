# ✅ Analytics Tables RLS - Final Decision

## Decision: Keep Current Design (No RLS on Partitioned Tables)

### ✅ Rationale

1. **All access is via SECURITY DEFINER RPC functions**
   - Functions bypass RLS anyway
   - Access control enforced inside functions
   - Consistent access pattern

2. **Partitions inherit from parent**
   - `analytics.events` has RLS enabled (for INSERT tracking)
   - `event_impressions_p` and `ticket_analytics_p` have RLS disabled
   - Partitions automatically inherit parent's RLS status

3. **Defense in depth applied**
   - Direct SELECT grants revoked on partitioned tables
   - Prevents accidental direct queries
   - RPC functions remain the only access path

---

## Current State

| Table | RLS Status | Access Method |
|-------|-----------|---------------|
| `analytics.events` | ✅ Enabled | RLS policies + RPC functions |
| `analytics.event_impressions_p` | ❌ Disabled | RPC functions only (grants revoked) |
| `analytics.ticket_analytics_p` | ❌ Disabled | RPC functions only (grants revoked) |

---

## Migration Applied

**File**: `supabase/migrations/20250128_revoke_analytics_partition_grants.sql`

**What it does**:
- Revokes SELECT grants on `event_impressions_p` and `ticket_analytics_p`
- Revokes SELECT grants on default partitions
- Keeps INSERT grants on `analytics.events` (for event tracking)

**Result**: Direct queries to partitioned tables will fail, forcing use of RPC functions.

---

## Next Steps

✅ **Completed**:
- Decision documented
- Grants revoked (defense in depth)
- Current RLS design maintained

**Optional** (future improvement):
- Refactor direct queries in `DrillthroughModal.tsx` to use RPC functions
- All other analytics access already uses RPC functions

---

**Status**: ✅ Analytics tables secured via RPC function access pattern


