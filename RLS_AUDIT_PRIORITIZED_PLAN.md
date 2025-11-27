# 🎯 RLS Security Audit - Prioritized Action Plan

**Based on**: Database state analysis results  
**Date**: 2025-01-28  
**Total Tables Without RLS**: 77

---

## 🔴 CRITICAL PRIORITY (Block Launch)

### 1. `organizations.org_memberships` - RLS DISABLED

**Status**: 🔴 **CRITICAL - BLOCKS LAUNCH**

**Risk**: Organization access control is completely broken. Anyone can read/modify memberships.

**Fix**: Already created - `supabase/migrations/20250128_fix_org_memberships_rls.sql`

**Action**: Deploy immediately

---

## 🟡 HIGH PRIORITY (Fix Before Launch)

### 2. Analytics System Tables (2 tables)

**Tables**:
- `analytics.audit_log` - Audit trail (should be service-role only)
- `analytics.query_cache` - Query cache (should be service-role only)

**Risk**: System logs and cache exposed to clients

**Fix Strategy**: Enable RLS with deny-all policies (service-role only)

---

### 3. Ticketing Tables (7 tables)

**Tables**:
- `ticketing.checkout_answers` - User checkout form answers
- `ticketing.checkout_questions` - Checkout form questions  
- `ticketing.checkout_sessions` - Active checkout sessions
- `ticketing.refund_log` - Refund processing logs
- `ticketing.refund_policies` - Refund policy config
- `ticketing.event_addons` - Event addon products
- `ticketing.order_addons` - Order addon line items

**Risk**: Payment/checkout data exposed

**Fix Strategy**:
- `checkout_sessions`, `checkout_answers` → User-scoped (`user_id = auth.uid()` or session belongs to user)
- `checkout_questions`, `refund_policies` → Public read (config), service-role write
- `refund_log` → Service-role only (system logs)
- `event_addons` → Respect event visibility
- `order_addons` → User-scoped (same as orders)

---

### 4. Public Schema Tables (3 tables)

**Tables**:
- `public.notification_emails` - Email notification logs
- `public.stripe_webhook_events` - Stripe webhook processing
- `public.user_email_preferences` - User email preferences

**Risk**: User data and system logs exposed

**Fix Strategy**:
- `notification_emails` → Service-role only (system logs)
- `stripe_webhook_events` → Service-role only (webhook processing)
- `user_email_preferences` → User-scoped (`user_id = auth.uid()`)

---

### 5. Events Reference/Junction Tables (6 tables)

**Tables**:
- `events.event_tags` - Event-tag relationships
- `events.hashtags` - Hashtag lookup table
- `events.post_hashtags` - Post-hashtag relationships
- `events.post_media` - Post-media relationships
- `events.post_mentions` - Post-mention relationships
- `events.media_assets` - Media asset metadata

**Risk**: Medium (reference data, but could leak post relationships)

**Fix Strategy**:
- `hashtags` → Public read (reference data), authenticated write
- `event_tags` → Public read (reference data), event owner/admin write
- `post_hashtags`, `post_media`, `post_mentions` → Respect post visibility (via JOIN to event_posts)
- `media_assets` → Respect media ownership/visibility

---

## 🟢 MEDIUM PRIORITY (Can Address Post-Launch, But Should Do Soon)

### 6. Analytics Partitioned Tables (60+ tables)

**Tables**: 60+ partitioned tables:
- `analytics.analytics_events_202505` through `202512` (8 tables)
- `analytics.event_impressions_p_202404` through `202502` (11 tables)
- `analytics.ticket_analytics_p_202404` through `202502` (11 tables)
- Plus default partitions and other partitioned tables

**Risk**: Analytics data exposed (if accessible to clients)

**Assessment**: 
- ✅ **OK if service-role only**: These are partitioned analytics tables. If they're only accessed via backend/Edge Functions, they don't need RLS.
- ❌ **NEEDS RLS if client-accessible**: Must verify grants first

**Action Required**:
1. **Check grants**: Run query to see if `anon`/`authenticated` have access
2. **If accessible**: Either enable RLS with service-role-only policies OR revoke grants
3. **If not accessible**: Document as "intentionally service-role only"

**Query to Check Grants**:
```sql
SELECT 
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'analytics'
    AND table_name LIKE '%analytics_events_%'
    OR table_name LIKE '%event_impressions_p%'
    OR table_name LIKE '%ticket_analytics_p%'
    AND grantee IN ('anon', 'authenticated');
```

---

### 7. Analytics System Tables (4 tables)

**Tables**:
- `analytics.blocklist_ips` - IP blocklist
- `analytics.blocklist_user_agents` - User agent blocklist
- `analytics.channel_taxonomy` - Channel taxonomy (probably public reference)
- `analytics.industry_benchmarks` - Industry benchmarks (probably public reference)

**Fix Strategy**:
- `blocklist_ips`, `blocklist_user_agents` → Service-role only
- `channel_taxonomy`, `industry_benchmarks` → Public read (reference data), service-role write

---

### 8. Analytics Other Tables (3 tables)

**Tables**:
- `analytics.post_video_counters` - Video analytics counters
- `analytics.ai_recommendation_events` - AI recommendation logs
- `analytics.event_impressions_default` - Default partition for event impressions

**Fix Strategy**:
- All should be service-role only (analytics data)

---

## 🔵 LOW PRIORITY (Optimization - Not Security Critical)

### 9. Analytics Views Exposed to API (7 views)

**Views**:
- `analytics_attribution_campaign`
- `analytics_campaign_daily`
- `analytics_creative_daily`
- `analytics_events` (in public schema)
- `analytics_viewability_campaign`
- `v_marketplace_analytics`

**Risk**: Low (views can have their own security, but should verify)

**Action**: Review each view's definition and verify they filter by user/org appropriately

---

## 📊 Summary Statistics

### By Category

| Category | Total Tables | With RLS | Without RLS | Priority |
|----------|--------------|----------|-------------|----------|
| **Financial** | 8 | 7 | 1 | 🔴 High |
| **User Data** | 7 | 5 | 2 | 🔴 High |
| **Events** | 46 | 20 | 26 | 🟡 Medium (many are partitioned analytics) |
| **System/Internal** | 13 | 11 | 2 | 🟡 High |
| **Analytics** | 32 | 2 | 30 | 🟢 Medium (verify service-role only) |
| **Audit/Log** | 8 | 6 | 2 | 🟡 High |
| **Other** | 70 | 54 | 16 | 🟡 High |
| **Settings** | 1 | 1 | 0 | ✅ OK |

---

## 🚀 Recommended Implementation Order

### Week 1: Critical + High Priority

**Day 1 (Today)**:
1. ✅ Fix `organizations.org_memberships` RLS (already created)

**Day 2-3**:
2. Enable RLS on analytics system tables (2 tables)
3. Enable RLS on ticketing tables (7 tables)
4. Enable RLS on public schema tables (3 tables)

**Day 4-5**:
5. Enable RLS on events reference tables (6 tables)
6. Enable RLS on analytics other tables (4 tables)

**Week 2: Medium Priority**

7. Verify analytics partitioned tables grants
8. Lock down partitioned tables (if needed)
9. Review analytics views

---

## 📝 Migration Files to Create

1. ✅ `20250128_fix_org_memberships_rls.sql` - Already created
2. `20250129_enable_rls_analytics_system.sql` - Analytics system tables
3. `20250129_enable_rls_ticketing.sql` - Ticketing tables
4. `20250129_enable_rls_public_schema.sql` - Public schema tables
5. `20250129_enable_rls_events_reference.sql` - Events reference tables
6. `20250129_enable_rls_analytics_other.sql` - Analytics other tables
7. `20250130_verify_analytics_partitions.sql` - Verify partitioned table grants

---

## ✅ Verification Checklist

After applying fixes:

- [ ] `organizations.org_memberships` has RLS enabled ✅
- [ ] All ticketing tables have RLS enabled
- [ ] All public schema tables have RLS enabled
- [ ] All analytics system tables have RLS enabled
- [ ] All events reference tables have RLS enabled
- [ ] Analytics partitioned tables verified as service-role only
- [ ] Re-run audit queries to confirm fixes
- [ ] Test critical user flows (signup, checkout, org access)

---

**Next Action**: Start with Day 1 fix (`organizations.org_memberships`), then proceed with Day 2-3 fixes.


