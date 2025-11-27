# 📚 RLS Audit Context Reference

> **Understanding what previous audits found and what tables intentionally have less restriction**

---

## 🎯 Purpose

This document provides context from previous security audits so we can distinguish between:
- ✅ **Intentional design** (tables/views that are supposed to have less restriction)
- ❌ **Security gaps** (tables that need fixing)

---

## 📋 Previous Audit Findings

### ✅ Already Fixed (Don't Re-Fix)

1. **System Tables RLS** (`20250105_enable_rls_internal_tables.sql`)
   - ✅ `model_feature_weights` - RLS enabled, deny-all policy
   - ✅ `outbox` - RLS enabled, deny-all policy
   - **Status**: These are service_role only (intentional)

2. **Materialized Views Lockdown** (`20250105_lockdown_materialized_views.sql`)
   - ✅ Analytics views locked down to service_role only
   - ✅ Tables with RLS but no policies → Added service-role-only policies
   - **Status**: These are backend-only (intentional)

3. **Duplicate Indexes** (`20250105_drop_duplicate_indexes.sql`)
   - ✅ Removed duplicate indexes
   - **Status**: Performance optimization (not security)

---

## 🔐 Tables That Intentionally Have Less Restriction

### 🔧 System/Internal Tables (Service-Role Only)

**These should have RLS enabled with deny-all policies**:

| Table | Purpose | Expected RLS |
|-------|---------|--------------|
| `model_feature_weights` | ML model weights | ✅ Deny-all (service_role only) |
| `outbox` | Message queue | ✅ Deny-all (service_role only) |
| `kv_store` | Key-value cache | ✅ Deny-all (service_role only) |
| `*_cache` tables | Cache tables | ✅ Deny-all (service_role only) |
| `*_queue` tables | Job queues | ✅ Deny-all (service_role only) |
| `*_audit` / `*_log` tables | Audit logs | ✅ Deny-all (service_role only) |
| `mv_refresh_log` | Materialized view refresh | ✅ Deny-all (service_role only) |

**Why**: These are backend-only, not meant for client access.

**Reference**: `20250105_enable_rls_internal_tables.sql`

---

### 📊 Analytics/Materialized Views (Service-Role Only)

**These should be locked down to service_role**:

| View | Purpose | Expected Access |
|------|---------|-----------------|
| `analytics_campaign_daily_mv` | Campaign analytics | ✅ service_role only |
| `event_video_kpis_daily` | Video KPIs | ✅ service_role only |
| `mv_event_quality_scores` | Quality scores | ✅ service_role only |
| `mv_event_reach_snapshot` | Reach metrics | ✅ service_role only |
| `mv_sponsorship_revenue` | Revenue data | ✅ service_role only |
| `trending_posts` | Trending algorithm | ✅ service_role only |
| `user_event_affinity` | User preferences | ✅ service_role only |
| `event_covis` | Co-visitation | ✅ service_role only |

**Why**: These aggregate across all data, should only be accessed via backend/Edge Functions.

**Reference**: `20250105_lockdown_materialized_views.sql`, `DATABASE_CLEANUP_COMPLETE.md`

---

### ⚙️ Public Read-Only Tables (Intentional Public Access)

**These are meant to be readable by anyone**:

| Table | Purpose | Expected RLS |
|-------|---------|--------------|
| `platform_settings` | Platform configuration | ✅ Public SELECT, service_role writes |
| `user_tag_preferences` | User preferences | ✅ User-scoped (user_id = auth.uid()) |

**Why**: Platform settings are public config. User preferences are user-scoped.

**Reference**: `20250104_add_missing_rls.sql`

---

### 🔐 SECURITY DEFINER Views (Intentional Architecture)

**These intentionally bypass RLS for performance/architecture reasons**:

**✅ Keep as-is (Performance/RLS Recursion)**:
- `events`, `event_posts`, `event_comments`, `event_reactions` - Feed performance
- `search_docs` - Search index
- Analytics views - Global aggregation

**⚠️ Review (May need refactoring)**:
- `user_profiles` - Could respect RLS
- `tickets`, `orders` - Financial data (review carefully)
- `organizations`, `org_memberships` - Organization access

**Reference**: `SECURITY_DEFINER_VIEWS_RATIONALE.md`, `SECURITY_WARNINGS_FIX.md`

**Key Point**: These are **architectural choices**, not bugs. The linter flags them, but many are intentional.

---

## ❌ Tables That NEED Strict RLS (Security Gaps)

### 👥 User Data Tables

**These must have user-scoped policies**:

| Table | Required Policy Pattern |
|-------|------------------------|
| `user_profiles` | `user_id = auth.uid()` OR public read |
| `saved_events` | `user_id = auth.uid()` |
| `follows` | User-scoped (own follows or public profiles) |

### 💰 Financial Tables

**These must have strict user/org isolation**:

| Table | Required Policy Pattern |
|-------|------------------------|
| `tickets` | `user_id = auth.uid()` OR org admin |
| `orders` | `user_id = auth.uid()` OR org admin |
| `invoices` | `user_id = auth.uid()` OR org admin |
| `refunds` | `user_id = auth.uid()` OR org admin |

### 🎉 Event Tables

**These must respect visibility settings**:

| Table | Required Policy Pattern |
|-------|------------------------|
| `events` | `is_public = true` OR `user_id = auth.uid()` OR ticket holder |
| `event_posts` | Event visibility check |
| `event_comments` | Event visibility check |

### 🏢 Organization Tables

**These must respect org membership**:

| Table | Required Policy Pattern |
|-------|------------------------|
| `organizations` | Public read OR org member |
| `org_memberships` | Own membership OR org admin |

---

## 📝 How to Use This Reference

### When Running the Audit

1. **Run database state analysis first**:
   ```sql
   -- Run: 20250128_database_state_analysis.sql
   -- This categorizes tables by type
   ```

2. **Cross-reference with this document**:
   - If table is in "System/Internal" → Expect deny-all policy (✅ OK)
   - If table is in "Analytics" → Expect service_role only (✅ OK)
   - If table is in "User/Financial" → Expect user-scoped policies (❌ Check!)

3. **Mark as intentional vs. security gap**:
   - ✅ Intentional = Document in audit report, no fix needed
   - ❌ Security gap = Add to fix plan

---

## 🔗 Related Documents

- **Main Audit Playbook**: `SECURITY_AUDIT_ENHANCED.md`
- **Database State Analysis**: `supabase/migrations/20250128_database_state_analysis.sql`
- **Previous Audit Summary**: `DATABASE_CLEANUP_COMPLETE.md`
- **SECURITY DEFINER Rationale**: `SECURITY_DEFINER_VIEWS_RATIONALE.md`
- **Security Warnings Fix**: `SECURITY_WARNINGS_FIX.md`

---

## ✅ Quick Checklist

When you see a table/view in the audit:

- [ ] Is it in the "System/Internal" list? → ✅ OK if deny-all
- [ ] Is it in the "Analytics" list? → ✅ OK if service_role only
- [ ] Is it in the "Public Read-Only" list? → ✅ OK if public SELECT
- [ ] Is it in the "SECURITY DEFINER" list? → ✅ OK if documented rationale
- [ ] Is it user/financial data? → ❌ Must have user-scoped policies
- [ ] Is it event data? → ❌ Must respect visibility settings

---

**Last Updated**: Based on previous audits (2025-01-05, 2025-11-05)  
**Next Review**: After running new audit


