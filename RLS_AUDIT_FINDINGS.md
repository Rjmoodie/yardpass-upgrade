# 🔒 RLS Security Audit - Findings Report

**Date**: 2025-01-28  
**Status**: 🔴 **CRITICAL ISSUE FOUND**  
**Total Tables Audited**: 174  
**Tables with RLS**: 97  
**Tables without RLS**: 77  
**Total Policies**: 254

---

## 🚨 CRITICAL SECURITY ISSUES (Fix Immediately)

### 1. ❌ `organizations.org_memberships` - RLS DISABLED

**Table**: `organizations.org_memberships`  
**Severity**: 🔴 **CRITICAL**  
**Risk**: Anyone can read/modify organization memberships!  
**Impact**: 
- Users can see all organization memberships
- Users can potentially modify membership roles
- Organization access control is completely broken

**Fix Required**: 
```sql
-- Enable RLS immediately
ALTER TABLE organizations.org_memberships ENABLE ROW LEVEL SECURITY;

-- Add policies:
-- - Users can see their own memberships
-- - Org admins can see members of their orgs
-- - Only service_role can modify (or specific policy for org admins)
```

**Status**: 🔴 **MUST FIX BEFORE LAUNCH**

---

## 🟡 HIGH PRIORITY (Review & Fix)

### Analytics Partitioned Tables Without RLS (60+ tables)

**Tables**:
- `analytics.analytics_events_202505` through `202512` (8 tables)
- `analytics.event_impressions_p_202404` through `202502` (11 tables)
- `analytics.ticket_analytics_p_202404` through `202502` (11 tables)

**Severity**: 🟡 **HIGH** (If exposed to clients)

**Assessment**:
- ✅ **OK if service-role only**: These are partitioned analytics tables. If they're only accessed via backend/Edge Functions with service_role, they don't need RLS.
- ❌ **NEEDS RLS if client-accessible**: If any client code can query these directly, they need RLS enabled.

**Action**:
1. Verify these tables are NOT accessible to `anon`/`authenticated` roles
2. If accessible, either:
   - Enable RLS with service-role-only policies, OR
   - Revoke all grants to `anon`/`authenticated`

**Reference**: Check `AUDIT_CONTEXT_REFERENCE.md` for analytics table handling

---

### Ticketing Tables Without RLS

**Tables**:
- `ticketing.checkout_answers` - Checkout form answers
- `ticketing.checkout_questions` - Checkout form questions
- `ticketing.checkout_sessions` - Active checkout sessions
- `ticketing.refund_log` - Refund processing logs
- `ticketing.refund_policies` - Refund policy config
- `ticketing.event_addons` - Event addon products
- `ticketing.order_addons` - Order addon items

**Severity**: 🟡 **HIGH** (Financial/payment data)

**Assessment**: These contain payment/checkout data. They should have RLS enabled.

**Fix Required**: Enable RLS with appropriate policies (service-role for system tables, user-scoped for user data)

---

### Events Reference Tables Without RLS

**Tables**:
- `events.event_tags` - Event tags (probably public reference data)
- `events.hashtags` - Hashtags (probably public reference data)
- `events.post_hashtags` - Post-hashtag relationships
- `events.post_media` - Post media relationships
- `events.post_mentions` - Post mentions
- `events.media_assets` - Media asset metadata

**Severity**: 🟢 **MEDIUM** (Reference/lookup data)

**Assessment**:
- `event_tags`, `hashtags` - Likely OK as public reference data (but verify)
- `post_hashtags`, `post_media`, `post_mentions` - Should respect post visibility
- `media_assets` - Should respect media ownership/visibility

**Action**: Review each table to determine if it needs RLS or if it's intentionally public reference data.

---

### Public Schema Tables Without RLS

**Tables**:
- `public.notification_emails` - Email notification logs
- `public.stripe_webhook_events` - Stripe webhook processing
- `public.user_email_preferences` - User email preferences

**Severity**: 🟡 **HIGH**

**Assessment**:
- `notification_emails` - Should be service-role only (system logs)
- `stripe_webhook_events` - Should be service-role only (webhook processing)
- `user_email_preferences` - Should have RLS (user-scoped: `user_id = auth.uid()`)

---

### Analytics System Tables Without RLS

**Tables**:
- `analytics.audit_log` - Audit logs (should be service-role only)
- `analytics.query_cache` - Query cache (should be service-role only)
- `analytics.blocklist_ips` - IP blocklist (should be service-role only)
- `analytics.blocklist_user_agents` - UA blocklist (should be service-role only)
- `analytics.channel_taxonomy` - Channel taxonomy (probably public reference)
- `analytics.industry_benchmarks` - Industry benchmarks (probably public reference)
- `analytics.post_video_counters` - Video analytics (should be service-role only)
- `analytics.ai_recommendation_events` - AI recommendation logs (should be service-role only)

**Severity**: 🟡 **HIGH** (System/analytics data)

**Assessment**: Most of these should be service-role only. Enable RLS with deny-all policies.

---

## ✅ INTENTIONALLY LESS RESTRICTED (OK - No Action Needed)

### System Tables Already Secured ✅

These have RLS enabled with service-role-only policies (already fixed):
- `public.model_feature_weights` ✅
- `public.outbox` ✅
- `public.mv_refresh_log` ✅
- `public.fit_recalc_queue` ✅

---

## 📊 Tables with RLS + Policies (Good Coverage)

### Critical Tables - All Commands Covered ✅

- ✅ `events.event_posts` - All commands (SELECT, INSERT, UPDATE, DELETE)
- ✅ `ticketing.orders` - All commands
- ✅ `ticketing.tickets` - All commands  
- ✅ `organizations.organizations` - All commands
- ✅ `users.user_profiles` - All commands

### Tables Missing Some Commands ⚠️

- ⚠️ `events.events` - Missing DELETE policy (probably intentional - events shouldn't be deleted via client)
- ⚠️ `analytics.events` - Missing UPDATE policy (probably intentional - analytics events are append-only)

---

## 🔐 SECURITY DEFINER Functions (100+ functions)

**Status**: ⚠️ **REVIEW NEEDED**

**Finding**: 100+ SECURITY DEFINER functions found.

**Assessment**: 
- Many of these are intentional (analytics functions, feed functions, permission helpers)
- Reference `SECURITY_DEFINER_VIEWS_RATIONALE.md` for context
- Action: Document each function's purpose and verify it's intentional

**Key Functions to Review**:
- Analytics functions (backfill, refresh, etc.) - Probably OK
- Feed functions (`get_home_feed_*`) - Already documented as intentional
- Permission helpers (`can_current_user_post`, `is_event_manager`) - Should be SECURITY DEFINER

---

## 📋 Grant Analysis

### Overly Permissive Grants Found ⚠️

**Issue**: Many tables have broad grants to `anon`/`authenticated`:
- `events.events`: `anon` has DELETE, INSERT, UPDATE, TRUNCATE grants
- `events.event_posts`: `anon` has DELETE, INSERT, UPDATE, TRUNCATE grants
- `ticketing.orders`: `anon` has DELETE, INSERT, UPDATE, TRUNCATE grants

**Assessment**: 
- These grants are probably inherited from schema defaults
- RLS policies should still enforce security
- **However**: Best practice is to REVOKE these and rely only on RLS

**Action**: Add REVOKE statements to migrations for sensitive tables

---

## 🎯 Priority Fix Plan

### Phase 1: Critical (Do Now) 🔴

1. **Fix `organizations.org_memberships`** - Enable RLS + add policies
   - Impact: Blocks organization data leaks
   - Effort: 30 minutes
   - Risk: Low (just adding security)

### Phase 2: High Priority (This Week) 🟡

2. **Enable RLS on ticketing tables**:
   - `checkout_answers`, `checkout_questions`, `checkout_sessions`
   - `refund_log`, `refund_policies`
   - `event_addons`, `order_addons`
   
3. **Enable RLS on public schema tables**:
   - `notification_emails` (service-role only)
   - `stripe_webhook_events` (service-role only)
   - `user_email_preferences` (user-scoped)

4. **Enable RLS on analytics system tables**:
   - `analytics.audit_log` (service-role only)
   - `analytics.query_cache` (service-role only)
   - `analytics.blocklist_ips` (service-role only)
   - `analytics.blocklist_user_agents` (service-role only)

### Phase 3: Medium Priority (Next Week) 🟢

5. **Review analytics partitioned tables**:
   - Verify they're service-role only
   - If not, enable RLS or revoke grants

6. **Review events reference tables**:
   - Determine if `event_tags`, `hashtags` should be public
   - Enable RLS on `post_hashtags`, `post_media`, `post_mentions`

7. **Review grants**:
   - REVOKE overly permissive grants on sensitive tables
   - Ensure RLS is the only access control mechanism

---

## ✅ Next Steps

1. [ ] **URGENT**: Fix `organizations.org_memberships` RLS
2. [ ] Document all SECURITY DEFINER functions
3. [ ] Verify analytics partitioned tables are service-role only
4. [ ] Enable RLS on ticketing tables
5. [ ] Enable RLS on public schema tables
6. [ ] Review and clean up grants

---

**Next Action**: Create migration to fix `organizations.org_memberships` RLS


