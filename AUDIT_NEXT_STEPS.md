# 🎯 RLS Audit - Next Steps & Action Items

Based on the audit findings, here's what we need to do:

---

## 🔴 URGENT (Do Today)

### 1. Fix `organizations.org_memberships` RLS

**Status**: 🔴 **CRITICAL - BLOCKS LAUNCH**

**File**: `supabase/migrations/20250128_fix_org_memberships_rls.sql` (already created)

**Action**:
```bash
# Apply the migration
supabase db push

# Or run in Supabase SQL Editor
```

**Time**: 5 minutes  
**Risk**: Low (just adding security)

---

## 🟡 HIGH PRIORITY (This Week)

### 2. Enable RLS on Ticketing Tables

**Tables**:
- `ticketing.checkout_answers`
- `ticketing.checkout_questions`
- `ticketing.checkout_sessions`
- `ticketing.refund_log`
- `ticketing.refund_policies`
- `ticketing.event_addons`
- `ticketing.order_addons`

**Action**: Create migration to enable RLS with appropriate policies (service-role for system tables, user-scoped for user data)

**Estimated Time**: 1-2 hours

---

### 3. Enable RLS on Public Schema Tables

**Tables**:
- `public.notification_emails` → Service-role only
- `public.stripe_webhook_events` → Service-role only
- `public.user_email_preferences` → User-scoped (`user_id = auth.uid()`)

**Action**: Create migration to enable RLS with appropriate policies

**Estimated Time**: 30 minutes

---

### 4. Enable RLS on Analytics System Tables

**Tables**:
- `analytics.audit_log` → Service-role only
- `analytics.query_cache` → Service-role only
- `analytics.blocklist_ips` → Service-role only
- `analytics.blocklist_user_agents` → Service-role only
- `analytics.post_video_counters` → Service-role only
- `analytics.ai_recommendation_events` → Service-role only

**Action**: Create migration to enable RLS with deny-all policies (service-role only)

**Estimated Time**: 30 minutes

---

## 🟢 MEDIUM PRIORITY (Next Week)

### 5. Review Analytics Partitioned Tables

**Tables**: 60+ partitioned tables (analytics_events_202505, event_impressions_p_202404, etc.)

**Action**:
1. Verify these tables are NOT accessible to `anon`/`authenticated` roles
2. Check grants: `SELECT * FROM information_schema.table_privileges WHERE table_name LIKE 'analytics_events_%'`
3. If accessible, either:
   - Enable RLS with service-role-only policies, OR
   - Revoke all grants to `anon`/`authenticated`

**Estimated Time**: 1 hour

---

### 6. Review Events Reference Tables

**Tables**:
- `events.event_tags` - Is this public reference data?
- `events.hashtags` - Is this public reference data?
- `events.post_hashtags` - Should respect post visibility
- `events.post_media` - Should respect post visibility
- `events.post_mentions` - Should respect post visibility
- `events.media_assets` - Should respect media ownership

**Action**: Review each table's purpose and decide:
- Public reference data? → No RLS needed (or public SELECT policy)
- User/post-scoped data? → Enable RLS with appropriate policies

**Estimated Time**: 1-2 hours

---

### 7. Review & Clean Up Grants

**Issue**: Many tables have broad grants (`DELETE`, `TRUNCATE`, etc.) to `anon`/`authenticated`

**Action**: Create migration to REVOKE overly permissive grants:
```sql
-- Example for events.events
REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES ON events.events FROM anon, authenticated;
-- Keep only SELECT, INSERT, UPDATE as needed (RLS will enforce access)
```

**Estimated Time**: 1-2 hours

---

## 📋 Documentation Tasks

### 8. Document SECURITY DEFINER Functions

**Action**: Review the 100+ SECURITY DEFINER functions and:
1. Document which ones are intentional
2. Verify each one's purpose
3. Update `SECURITY_DEFINER_VIEWS_RATIONALE.md` if needed

**Estimated Time**: 2-3 hours

---

## ✅ Checklist

### Critical (Blocks Launch)
- [ ] Fix `organizations.org_memberships` RLS

### High Priority (Before Launch)
- [ ] Enable RLS on ticketing tables
- [ ] Enable RLS on public schema tables  
- [ ] Enable RLS on analytics system tables

### Medium Priority (Can do after launch, but should do soon)
- [ ] Review analytics partitioned tables
- [ ] Review events reference tables
- [ ] Clean up overly permissive grants
- [ ] Document SECURITY DEFINER functions

---

## 🚀 Quick Win Script

Want to fix the critical issue right now? Run this:

```bash
# In Supabase SQL Editor, paste the contents of:
supabase/migrations/20250128_fix_org_memberships_rls.sql
```

That's it! ✅


