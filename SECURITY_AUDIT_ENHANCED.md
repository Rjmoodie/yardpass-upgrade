# 🔒 RLS Security Audit - Enhanced Systematic Playbook

> **Status**: 🟡 In Progress  
> **Started**: Today  
> **Owner**: BE Lead  
> **Priority**: 🔴 Critical  
> **Version**: 2.0 Enhanced

---

## 🎯 Executive Summary

This audit ensures **zero unauthorized data access** through comprehensive Row Level Security (RLS) policy verification, testing, and hardening across all Supabase tables, views, and functions.

**Audit Scope**: All tables in `public`, `users`, `events`, `organizations`, `ticketing`, and `analytics` schemas

**Expected Outcome**: 
- ✅ All sensitive tables protected by RLS
- ✅ All policies tested and verified
- ✅ All security gaps identified and fixed
- ✅ Zero data leaks possible across tenants

---

## 📐 Part 0: Threat Model & Security Assumptions

### Roles & Access Levels

**Supabase Built-in Roles:**
- `anon` → Unauthenticated public users (no JWT)
- `authenticated` → Logged-in users (has valid JWT with `auth.uid()`)
- `service_role` → **BYPASSES ALL RLS** - Internal/system operations only

**Custom Roles (Our System):**
- `attendee` → Regular user (stored in `users.user_profiles.role`)
- `organizer` → Event creator/organization member (checked via `org_memberships`)
- `admin` → Platform administrator (special role, TBD)

**Role Representation:**
- User roles stored in `users.user_profiles.role` column
- Organization membership via `organizations.org_memberships` table
- Role checks use `auth.uid()` for current user ID

### Trusted Roles That Bypass RLS

⚠️ **CRITICAL**: The following bypass RLS entirely:
- `service_role` key → Used in Edge Functions, triggers, migrations
- Functions with `SECURITY DEFINER` → Run as function owner (usually `postgres`)

**Rule**: Only use `SECURITY DEFINER` when absolutely necessary, and document why.

### Key Security Risks We're Defending Against

1. **Cross-Tenant Data Leaks**
   - User A sees User B's tickets, orders, or private data
   - Organization A sees Organization B's events, revenue, analytics
   - **Tenant Boundary**: `user_id` and `org_id` isolation is critical

2. **Privilege Escalation**
   - Attendee escalating to organizer/admin role
   - User accessing data they shouldn't (e.g., private events without ticket)

3. **Payment/Financial Data Exposure**
   - Users seeing others' payment details
   - Order data visible across users
   - Revenue data visible to non-organizers

4. **Multi-Tenant Model**
   - **Primary Boundary**: `user_id = auth.uid()` (user isolation)
   - **Secondary Boundary**: `org_id` via `org_memberships` (organization isolation)
   - **Event Boundary**: `event_id` with visibility rules (public vs private)

### Security Principles

**Deny-by-Default Rule**: 
> Any table with RLS enabled must be **unusable** until explicit policies are created. No implicit access via GRANTs or permissive policies.

**Multi-Tenant Isolation Rule**:
> Every policy on sensitive tables must explicitly filter by:
> - `user_id = auth.uid()` OR
> - `org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid() AND role IN ('owner','admin','editor'))` OR
> - Public visibility flag (`is_public = true`)

**Least Privilege Rule**:
> Grant only the minimum access needed. If users shouldn't delete, don't create DELETE policies. If guests shouldn't write, don't allow INSERT for `anon`.

---

## 📋 Part 1: Inventory & Discovery

### Step 1.0: Understand Database State (NEW - Run First!)

**Action**: Run `supabase/migrations/20250128_database_state_analysis.sql` to understand:
- Which tables are system/internal (should be service_role only)
- Which tables are analytics (should be service_role only)
- Which tables are public read-only (intentionally less restricted)
- Which views are SECURITY DEFINER (intentional architecture)

**Why This Matters**: Not all tables need strict RLS. Some are intentionally:
- 🔧 **System tables** (`model_feature_weights`, `outbox`) - Should deny all to clients
- 📊 **Analytics views** - Should be service_role only
- ⚙️ **Public settings** (`platform_settings`) - Anyone can read
- 🔐 **SECURITY DEFINER views** - Intentional architecture (see `SECURITY_DEFINER_VIEWS_RATIONALE.md`)

**Fill in Results**:
- System/internal tables found: [Document here]
- Analytics views found: [Document here]
- Public read-only tables: [Document here]
- SECURITY DEFINER views: [Document here]

### Step 1.1: List All Tables with RLS Status

**Action**: Run `supabase/migrations/20250128_rls_security_audit.sql` → Part 1

**Output**: Complete list of all tables showing:
- ✅ RLS Enabled (secure)
- ❌ RLS Disabled (security risk)

**Important**: Cross-reference with Step 1.0 results:
- ✅ System tables with RLS + deny-all policy = Good
- ❌ User/financial tables without RLS = Critical issue
- ⚠️ Public settings without RLS = Review if intentional

**Fill in Results**:
- Tables with RLS disabled: [Document here]
- Tables with RLS enabled: [Document here]
- Tables that are intentionally less restricted: [Document here from Step 1.0]

### Step 1.2: Check for Missing RLS on Sensitive Tables

**Query**:
```sql
-- Tables with PII/financial info but RLS disabled (CRITICAL!)
SELECT 
    schemaname || '.' || tablename as table_name,
    '❌ RLS DISABLED ON SENSITIVE TABLE!' as issue,
    'CRITICAL' as severity
FROM pg_tables
WHERE schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND rowsecurity = false
    AND tablename IN (
        'events', 'event_posts', 'tickets', 'orders',
        'user_profiles', 'organizations', 'org_memberships',
        'saved_events', 'event_comments', 'follows'
    )
ORDER BY schemaname, tablename;
```

**Results**:
- [ ] Issue found: ________________ | Severity: 🔴

### Step 1.3: Verify Default Grants Revoked (Sensitive Tables Only)

**Rule**: Sensitive tables (user/financial data) should have explicit REVOKE statements. **Exception**: System tables and analytics views should be service_role only (which is already secure).

**Tables That SHOULD Have Grants Revoked**:
- User data: `user_profiles`, `organizations`, `org_memberships`
- Financial: `tickets`, `orders`, `invoices`, `refunds`
- Events: `events`, `event_posts`

**Tables That DON'T Need Grants Revoked** (Already service_role only):
- System: `model_feature_weights`, `outbox`
- Analytics: Materialized views (already locked down per previous audit)

**Check Query**:
```sql
-- Check current grants on critical tables
SELECT 
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema IN ('public', 'users', 'events', 'organizations', 'ticketing')
    AND table_name IN ('events', 'event_posts', 'tickets', 'orders', 'user_profiles')
    AND grantee IN ('public', 'anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
```

**Expected**: No grants to `public`, `anon`, or `authenticated` (except via RLS policies)

**Action Items**:
- [ ] Add REVOKE statements to migrations if grants exist:
  ```sql
  REVOKE ALL ON public.tickets FROM public;
  REVOKE ALL ON public.orders FROM public;
  REVOKE ALL ON public.events FROM public;
  REVOKE ALL ON public.event_posts FROM public;
  -- etc for all sensitive tables
  ```

### Step 1.4: List All Existing Policies

**Action**: Run audit SQL → Part 2

**Output**: Count of policies per table and which commands are covered

**Document**:
- [ ] Tables with policies: [List]
- [ ] Tables with NO policies: [List - these block all access!]

---

## 📋 Part 2: Find Critical Security Gaps

### Step 2.1: Tables with RLS but No Policies (Blocks All Access)

**Query**: Run audit SQL → Part 3

**Critical Issue**: If RLS is enabled but no policies exist, **nobody can access the table** (even legitimate users).

**Action**: 
- [ ] Either: Create policies
- [ ] Or: Disable RLS if table should be publicly accessible (rare!)

**Results**:
- [ ] Table: ________________ | Status: ❌ Blocks all access

### Step 2.2: Critical Tables with RLS Disabled (Excluding System Tables)

**Query**: Run audit SQL → Part 4

**Critical Issue**: Sensitive data exposed to all users!

**Exception**: System/internal tables like `model_feature_weights` and `outbox` should have RLS enabled with deny-all policies (already fixed per `20250105_enable_rls_internal_tables.sql`).

**Action**: 
- [ ] Enable RLS immediately for user/financial/event tables
- [ ] Create appropriate policies (user-scoped, not deny-all)
- [ ] Test access after fix

**System Tables Are OK** (These should have deny-all):
- [ ] `model_feature_weights` - ✅ Should have deny-all (service_role only)
- [ ] `outbox` - ✅ Should have deny-all (service_role only)
- [ ] Any audit/log tables - ✅ Should have deny-all (service_role only)

**Results**:
- [ ] Table: ________________ | Type: User/Financial/Event | Severity: 🔴 Critical | Fix: ________________
- [ ] Table: ________________ | Type: System (OK if deny-all) | Status: ✅ Review only

### Step 2.3: Overly Permissive Policies

**Enhanced Query**:
```sql
-- Find potentially dangerous policies
SELECT 
    schemaname || '.' || tablename as table_name,
    policyname,
    cmd as command,
    roles,
    CASE 
        WHEN roles = '{public}' OR roles = '{anon}' THEN '❌ PUBLIC/ANON ACCESS'
        WHEN qual IS NULL OR qual = 'true' OR regexp_replace(qual, '\s+', '', 'g') = '' THEN '❌ ALLOWS ALL'
        WHEN cmd = 'SELECT' AND NOT (qual LIKE '%auth.uid()%' OR qual LIKE '%user_id%' OR qual LIKE '%org_id%') THEN '⚠️ NO TENANT FILTER'
        ELSE 'Review'
    END as concern,
    qual as policy_expression
FROM pg_policies
WHERE schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND (
        qual IS NULL 
        OR qual = 'true' 
        OR regexp_replace(qual, '\s+', '', 'g') = ''
        OR (roles = '{public}' AND tablename IN ('events', 'event_posts', 'tickets', 'orders', 'user_profiles'))
        OR (cmd = 'SELECT' AND tablename IN ('events', 'event_posts', 'tickets', 'orders', 'user_profiles') 
            AND NOT (qual LIKE '%auth.uid()%' OR qual LIKE '%user_id%' OR qual LIKE '%org_id%' OR qual LIKE '%is_public%'))
    )
ORDER BY 
    CASE WHEN concern LIKE '❌%' THEN 1 ELSE 2 END,
    tablename, 
    policyname;
```

**Review Checklist**:
- [ ] If policy has `TO public` or `TO anon` on sensitive table → **Must justify in report**
- [ ] If policy has `TO authenticated` but no `auth.uid()` or tenant filter → **Probably a bug**
- [ ] If `qual = 'true'` or NULL → **Allows all users, verify intent**

**Results**:
- [ ] Policy: ________________ | Table: ________________ | Concern: ________________ | Action: ________________

### Step 2.4: Missing Command Policies

**Query**: Run audit SQL → Part 7

**Rule**: For critical tables, we expect policies for:
- ✅ SELECT (read)
- ✅ INSERT (create)
- ✅ UPDATE (modify)
- ✅ DELETE (remove)

**Exception**: If a table should never be writable by users (e.g., audit logs), document why DELETE/UPDATE are missing.

**Results**:
- [ ] Table: ________________ | Missing: SELECT / INSERT / UPDATE / DELETE | Status: 🔴 / ✅

---

## 📋 Part 3: Audit Views & Functions (RLS Bypasses)

### Step 3.1: List All Views

**Query**:
```sql
-- All views in our schemas
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE schemaname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
ORDER BY schemaname, viewname;
```

**Security Concern**: Views inherit RLS from underlying tables, but can expose additional data through JOINs.

**Action Items**:
- [ ] Review each view definition
- [ ] Verify views don't leak cross-tenant data
- [ ] Test views with different user roles

**Views to Audit**:
- [ ] View: ________________ | Security check: ________________

### Step 3.2: List SECURITY DEFINER Functions

**Query**:
```sql
-- Functions that bypass RLS
SELECT
    n.nspname AS schemaname,
    p.proname AS function_name,
    p.prosecdef AS is_security_definer,
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'users', 'events', 'organizations', 'ticketing', 'analytics')
    AND p.prosecdef = true
ORDER BY n.nspname, p.proname;
```

**Security Concern**: `SECURITY DEFINER` functions run as the function owner (usually `postgres`) and **bypass RLS entirely**.

**Action Items**:
- [ ] Document why each function needs `SECURITY DEFINER`
- [ ] Verify function doesn't expose data inappropriately
- [ ] Test function with different user roles
- [ ] Consider if function can be rewritten without `SECURITY DEFINER`

**Functions to Audit**:
- [ ] Function: `handle_new_user()` | Reason: Auto-creates profile | Status: ✅ Documented
- [ ] Function: ________________ | Reason: ________________ | Status: ________________

**Rule**: 
> Any `SECURITY DEFINER` function must have a documented reason and be tested as part of this audit.

---

## 📋 Part 4: Multi-Tenant Policy Patterns

### Standard Policy Patterns

**Pattern 1: User Isolation (Own Data Only)**
```sql
-- Users can only access their own records
USING (user_id = auth.uid())
```

**Pattern 2: Organization-Based Access**
```sql
-- Users can access data for organizations they belong to
USING (
    org_id IN (
        SELECT org_id 
        FROM organizations.org_memberships 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'editor')
    )
)
```

**Pattern 3: Event-Based Access**
```sql
-- Public events OR events user has tickets for
USING (
    is_public = true
    OR EXISTS (
        SELECT 1 FROM tickets t
        WHERE t.event_id = events.id
        AND t.user_id = auth.uid()
    )
)
```

**Pattern 4: Author-Only Modification**
```sql
-- Users can only modify records they created
USING (author_user_id = auth.uid())
WITH CHECK (author_user_id = auth.uid())
```

### Policy Pattern Compliance Check

For each critical table, verify it uses appropriate patterns:

- [ ] `events` → Uses Pattern 3 (public + ticket holders)
- [ ] `event_posts` → Uses Pattern 3 + Pattern 4 (author can edit)
- [ ] `tickets` → Uses Pattern 1 (own tickets only)
- [ ] `orders` → Uses Pattern 1 (own orders only)
- [ ] `user_profiles` → Uses Pattern 1 (own profile)
- [ ] `organizations` → Uses Pattern 2 (org members)

**Non-Compliant Tables**:
- [ ] Table: ________________ | Missing Pattern: ________________ | Fix: ________________

---

## 📋 Part 5: Comprehensive Test Matrix

### RLS Test Matrix (Table-Driven)

| Table | Scenario | Role | Query / Action | Expected Result | Status |
|-------|----------|------|----------------|-----------------|--------|
| `events` | Guest sees public events | `anon` | `SELECT * FROM events WHERE is_public = true LIMIT 5;` | Rows returned | ⬜ |
| `events` | Guest sees private events | `anon` | `SELECT * FROM events WHERE is_public = false LIMIT 5;` | 0 rows | ⬜ |
| `events` | User sees private event they have ticket for | `authenticated` | `SELECT e.* FROM events e JOIN tickets t ON t.event_id = e.id WHERE t.user_id = auth.uid() AND e.is_public = false;` | Only events with tickets | ⬜ |
| `events` | Organizer updates own event | `authenticated` (organizer) | `UPDATE events SET title = 'Test' WHERE id = '<own_event_id>' AND created_by = auth.uid();` | 1 row updated | ⬜ |
| `events` | User updates someone else's event | `authenticated` | `UPDATE events SET title = 'Hacked' WHERE id = '<other_event_id>';` | 0 rows updated | ⬜ |
| `event_posts` | Guest sees posts for public events | `anon` | `SELECT * FROM event_posts ep JOIN events e ON e.id = ep.event_id WHERE e.is_public = true LIMIT 5;` | Rows returned | ⬜ |
| `event_posts` | User creates post | `authenticated` | `INSERT INTO event_posts (event_id, author_user_id, text) VALUES ('<event_id>', auth.uid(), 'Test');` | Success | ⬜ |
| `event_posts` | User edits own post | `authenticated` | `UPDATE event_posts SET text = 'Updated' WHERE id = '<own_post_id>' AND author_user_id = auth.uid();` | 1 row updated | ⬜ |
| `event_posts` | User edits someone else's post | `authenticated` | `UPDATE event_posts SET text = 'Hacked' WHERE id = '<other_post_id>';` | 0 rows updated | ⬜ |
| `event_posts` | User deletes own post | `authenticated` | `DELETE FROM event_posts WHERE id = '<own_post_id>' AND author_user_id = auth.uid();` | 1 row deleted | ⬜ |
| `event_posts` | User deletes someone else's post | `authenticated` | `DELETE FROM event_posts WHERE id = '<other_post_id>';` | 0 rows deleted | ⬜ |
| `tickets` | User sees own tickets | `authenticated` | `SELECT * FROM tickets WHERE user_id = auth.uid();` | Only user's tickets | ⬜ |
| `tickets` | User sees another user's tickets | `authenticated` | `SELECT * FROM tickets WHERE user_id != auth.uid();` | 0 rows | ⬜ |
| `tickets` | Organizer sees tickets for their events | `authenticated` (organizer) | `SELECT t.* FROM tickets t JOIN events e ON e.id = t.event_id WHERE e.created_by = auth.uid();` | Only organizer's events | ⬜ |
| `tickets` | User updates ticket status | `authenticated` | `UPDATE tickets SET status = 'redeemed' WHERE id = '<ticket_id>';` | 0 rows (should be system-only) | ⬜ |
| `orders` | User sees own orders | `authenticated` | `SELECT * FROM orders WHERE user_id = auth.uid();` | Only user's orders | ⬜ |
| `orders` | User sees another user's orders | `authenticated` | `SELECT * FROM orders WHERE user_id != auth.uid();` | 0 rows | ⬜ |
| `orders` | User modifies order | `authenticated` | `UPDATE orders SET total_cents = 0 WHERE id = '<order_id>';` | 0 rows (should be system-only) | ⬜ |
| `user_profiles` | User reads any public profile | `authenticated` | `SELECT * FROM users.user_profiles WHERE user_id = '<other_user_id>';` | Profile returned | ⬜ |
| `user_profiles` | User updates own profile | `authenticated` | `UPDATE users.user_profiles SET display_name = 'New Name' WHERE user_id = auth.uid();` | 1 row updated | ⬜ |
| `user_profiles` | User updates someone else's profile | `authenticated` | `UPDATE users.user_profiles SET display_name = 'Hacked' WHERE user_id != auth.uid();` | 0 rows updated | ⬜ |
| `user_profiles` | User changes own role | `authenticated` | `UPDATE users.user_profiles SET role = 'organizer' WHERE user_id = auth.uid();` | 0 rows (role should be server-controlled) | ⬜ |
| `organizations` | User reads public organizations | `authenticated` | `SELECT * FROM organizations WHERE is_public = true;` | Rows returned | ⬜ |
| `organizations` | Org owner updates their org | `authenticated` (owner) | `UPDATE organizations SET name = 'Updated' WHERE id = '<org_id>' AND EXISTS (SELECT 1 FROM org_memberships om WHERE om.org_id = organizations.id AND om.user_id = auth.uid() AND om.role = 'owner');` | 1 row updated | ⬜ |
| `organizations` | Non-member updates org | `authenticated` | `UPDATE organizations SET name = 'Hacked' WHERE id = '<org_id>';` | 0 rows updated | ⬜ |
| `org_memberships` | User sees own memberships | `authenticated` | `SELECT * FROM organizations.org_memberships WHERE user_id = auth.uid();` | User's memberships | ⬜ |
| `org_memberships` | User sees other users' memberships | `authenticated` | `SELECT * FROM organizations.org_memberships WHERE user_id != auth.uid();` | 0 rows | ⬜ |
| `org_memberships` | Org admin sees all members | `authenticated` (admin) | `SELECT om.* FROM organizations.org_memberships om JOIN organizations o ON o.id = om.org_id WHERE EXISTS (SELECT 1 FROM organizations.org_memberships admin WHERE admin.org_id = om.org_id AND admin.user_id = auth.uid() AND admin.role IN ('owner', 'admin'));` | All members of admin's orgs | ⬜ |
| `saved_events` | User sees own saved events | `authenticated` | `SELECT * FROM saved_events WHERE user_id = auth.uid();` | User's saved events | ⬜ |
| `saved_events` | User sees another user's saved events | `authenticated` | `SELECT * FROM saved_events WHERE user_id != auth.uid();` | 0 rows | ⬜ |

**Test Execution**:
- [ ] Run all tests as `anon` role
- [ ] Run all tests as `authenticated` role with test user
- [ ] Run organizer tests with organizer test user
- [ ] Document all failures

**Status Legend**:
- ✅ Pass
- ❌ Fail
- ⬜ Not Tested Yet

---

## 📋 Part 6: Environment Parity Check

### Step 6.1: Compare RLS Status Across Environments

**Action**: Run the same inventory queries in:
- [ ] Development environment
- [ ] Staging environment
- [ ] Production environment

**Compare**:
- Tables with RLS enabled/disabled
- Policy names & counts per table
- Policy expressions (qual, with_check)

**Drift Detection**:
- [ ] Dev vs Staging: Differences found? ________________
- [ ] Staging vs Prod: Differences found? ________________
- [ ] Dev vs Prod: Differences found? ________________

### Step 6.2: Verify All Changes Are in Migrations

**Rule**: **All RLS changes must be in migration files**, not manually applied in dashboard.

**Check**:
- [ ] Review all recent migrations for RLS changes
- [ ] Compare migration history with dashboard state
- [ ] Ensure no manual policy changes exist outside migrations

**Issues Found**:
- [ ] Manual change found: ________________ | Fix: Add to migration file

---

## 📋 Part 7: Detailed Table Audits

### Table: `events`

**Schema**: `events.events` or `public.events`

**Current RLS Status**: ⬜ Enabled / ❌ Disabled

**Policies Found**:
```
Policy Name: [Name]
Command: [SELECT/INSERT/UPDATE/DELETE]
Roles: [anon/authenticated]
Expression: [USING clause]
Status: ✅ Working / ❌ Needs Fix / 🔴 Missing
```

**Test Results** (from Test Matrix):
- [ ] Guest sees public events: ✅ / ❌
- [ ] Guest blocked from private events: ✅ / ❌
- [ ] User can update own event: ✅ / ❌
- [ ] User blocked from updating others' events: ✅ / ❌

**Issues Found**:
- [ ] Issue: ________________
  - Severity: 🔴 Critical / 🟡 High / 🟢 Medium
  - Owner: [Name/Role]
  - Target Fix Date: [Date]
  - Status: 🔴 Open / 🟡 In Progress / ✅ Fixed

---

### Table: `event_posts`

**Schema**: `events.event_posts` or `public.event_posts`

**Current RLS Status**: ⬜ Enabled / ❌ Disabled

**Policies Found**: [Document here]

**Test Results**:
- [ ] All tests from matrix: ✅ / ❌

**Issues Found**: [Document here]

---

### Table: `tickets`

**Schema**: `ticketing.tickets` or `public.tickets`

**Current RLS Status**: ⬜ Enabled / ❌ Disabled

**Policies Found**: [Document here]

**Test Results**:
- [ ] All tests from matrix: ✅ / ❌

**Issues Found**: [Document here]

---

### Table: `orders`

**Schema**: `ticketing.orders` or `public.orders`

**Current RLS Status**: ⬜ Enabled / ❌ Disabled

**Policies Found**: [Document here]

**Test Results**:
- [ ] All tests from matrix: ✅ / ❌

**Issues Found**: [Document here]

---

### Table: `user_profiles`

**Schema**: `users.user_profiles`

**Current RLS Status**: ⬜ Enabled / ❌ Disabled

**Policies Found**: [Document here]

**Test Results**:
- [ ] All tests from matrix: ✅ / ❌

**Issues Found**: [Document here]

---

### Table: `organizations`

**Schema**: `organizations.organizations` or `public.organizations`

**Current RLS Status**: ⬜ Enabled / ❌ Disabled

**Policies Found**: [Document here]

**Test Results**:
- [ ] All tests from matrix: ✅ / ❌

**Issues Found**: [Document here]

---

### Table: `org_memberships`

**Schema**: `organizations.org_memberships`

**Current RLS Status**: ⬜ Enabled / ❌ Disabled

**Policies Found**: [Document here]

**Test Results**:
- [ ] All tests from matrix: ✅ / ❌

**Issues Found**: [Document here]

---

## 📋 Part 8: Security Audit Report

### Report Summary

**Date**: [Date]  
**Auditor**: [Name]  
**Scope**: All tables in public, users, events, organizations, ticketing, analytics schemas

#### Metrics
- Total tables audited: [Number]
- Tables with RLS enabled: [Number]
- Tables with RLS disabled: [Number] ⚠️
- Policies reviewed: [Number]
- Views audited: [Number]
- SECURITY DEFINER functions audited: [Number]
- Issues found: [Number]
  - 🔴 Critical: [Number]
  - 🟡 High: [Number]
  - 🟢 Medium: [Number]

#### Critical Issues Found

| # | Issue | Table | Severity | Impact | Owner | Target Date | Status |
|---|-------|-------|----------|--------|-------|-------------|--------|
| 1 | [Description] | [Table] | 🔴 Critical | [What can go wrong] | [Name] | [Date] | ⬜ Open |
| 2 | [Description] | [Table] | 🔴 Critical | [Impact] | [Name] | [Date] | ⬜ Open |

#### High Priority Issues

| # | Issue | Table | Severity | Impact | Owner | Target Date | Status |
|---|-------|-------|----------|--------|-------|-------------|--------|
| 1 | [Description] | [Table] | 🟡 High | [Impact] | [Name] | [Date] | ⬜ Open |

#### Medium Priority Issues

| # | Issue | Table | Severity | Impact | Owner | Target Date | Status |
|---|-------|-------|----------|--------|-------|-------------|--------|
| 1 | [Description] | [Table] | 🟢 Medium | [Impact] | [Name] | [Date] | ⬜ Open |

### Fix Plan

For each issue, document:

**Issue #1**: [Title]
- **Table**: [Table name]
- **Current Problem**: [What's wrong]
- **Security Risk**: [What can happen]
- **Fix**:
  ```sql
  -- SQL fix here
  ```
- **Owner**: [Name/Role]
- **Target Fix Date**: [Date]
- **Status**: 🔴 Open / 🟡 In Progress / ✅ Fixed / ✅ Verified
- **Test After Fix**: [What to test]

---

## 📋 Part 9: Post-Fix Regression Testing

### Step 9.1: Re-run Automated Checks

After all fixes are applied:

- [ ] Re-run Part 1: Inventory all tables
- [ ] Re-run Part 2: Find critical gaps
- [ ] Re-run Part 3: Audit views & functions
- [ ] Re-run Part 6: Environment parity check

### Step 9.2: Re-run Test Matrix

For each critical table (`events`, `event_posts`, `tickets`, `orders`, `user_profiles`, `organizations`, `org_memberships`):

- [ ] All "happy path" tests still pass (legit users can access)
- [ ] All "negative" tests still block (unauthorized access prevented)
- [ ] All edge cases tested
- [ ] Document any test failures

### Step 9.3: Final Verification Checklist

- [ ] ✅ All critical tables have RLS enabled
- [ ] ✅ All critical tables have appropriate policies
- [ ] ✅ All overly permissive policies fixed
- [ ] ✅ All missing command policies added
- [ ] ✅ All SECURITY DEFINER functions documented
- [ ] ✅ All views audited and secure
- [ ] ✅ All test matrix scenarios pass
- [ ] ✅ No drift between environments
- [ ] ✅ All fixes documented in migrations
- [ ] ✅ All critical scenarios re-tested and passed after fixes

---

## ✅ Audit Completion Checklist

### Phase 1: Discovery (Week 2)
- [ ] Run initial audit SQL queries
- [ ] Document all tables and RLS status
- [ ] List all existing policies
- [ ] List all views
- [ ] List all SECURITY DEFINER functions
- [ ] Identify all critical issues

### Phase 2: Testing (Week 2-3)
- [ ] Execute all tests in Test Matrix
- [ ] Document test results
- [ ] Test each critical table thoroughly
- [ ] Test with multiple user roles

### Phase 3: Fixes (Week 3-4)
- [ ] Fix all critical issues
- [ ] Fix all high priority issues
- [ ] Fix medium priority issues
- [ ] Add missing policies
- [ ] Remove overly permissive policies
- [ ] Document all SECURITY DEFINER functions

### Phase 4: Verification (Week 4)
- [ ] Re-run all automated checks
- [ ] Re-run entire Test Matrix
- [ ] Verify environment parity
- [ ] Final security review

### Phase 5: Documentation (Week 4)
- [ ] Complete security audit report
- [ ] Document all policies
- [ ] Create fix log
- [ ] Update threat model if needed

---

## 🔗 Resources & References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Guide](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Common RLS Patterns](https://supabase.com/docs/guides/auth/row-level-security#policies)
- [Multi-Tenant Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security#multi-tenant-security)

---

## 📝 Notes & Decisions

### Technical Decisions
- **Date**: [Date] | **Decision**: [What we decided] | **Rationale**: [Why]

### Security Decisions
- **Date**: [Date] | **Decision**: [What we decided] | **Rationale**: [Why]

---

*This is a living document - update as we progress through the audit*

