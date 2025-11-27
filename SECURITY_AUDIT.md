# 🔒 RLS Security Audit - Liventix Platform

> **Status**: 🟡 In Progress  
> **Started**: Today  
> **Owner**: BE Lead  
> **Priority**: 🔴 Critical

---

## 🎯 Audit Goals

1. Verify all sensitive tables have RLS enabled
2. Ensure users can only access data they should
3. Test with different user roles (guest, attendee, organizer, admin)
4. Document all policies and any security gaps
5. Fix any vulnerabilities found

---

## 📋 Step 1: Inventory All Tables

### Query: List All Tables with RLS Status

```sql
-- Get all tables in public and users schemas with RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ Enabled'
        ELSE '❌ DISABLED - SECURITY RISK!'
    END as status
FROM pg_tables 
WHERE schemaname IN ('public', 'users')
ORDER BY schemaname, tablename;
```

### Tables to Audit (Priority Order)

#### 🔴 Critical Priority (Contains sensitive user/financial data)
- [ ] `events` - Event data, may contain private events
- [ ] `event_posts` - User-generated content
- [ ] `tickets` - Purchase data, personal info
- [ ] `orders` - Payment transactions
- [ ] `user_profiles` - Personal user information
- [ ] `organizations` - Organizer data
- [ ] `org_memberships` - Access control for organizations
- [ ] `saved_events` - User preferences

#### 🟡 High Priority (Moderate sensitivity)
- [ ] `event_comments` - User-generated content
- [ ] `event_reactions` - User interactions
- [ ] `event_comment_reactions` - User interactions
- [ ] `follows` - User relationships
- [ ] `sponsorship_orders` - Business data
- [ ] `ticket_tiers` - Pricing information

#### 🟢 Medium Priority (Lower sensitivity but still important)
- [ ] `event_share_assets` - Media assets
- [ ] `notification_logs` - User activity logs
- [ ] `user_devices` - Device tracking

---

## 📋 Step 2: Check Current RLS Policies

### Query: List All RLS Policies

```sql
-- Get all RLS policies for a specific table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check
FROM pg_policies
WHERE schemaname IN ('public', 'users')
ORDER BY tablename, policyname;
```

### Query: Check RLS Status per Table

```sql
-- Check RLS status for critical tables
SELECT 
    schemaname || '.' || tablename as full_table_name,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies 
     WHERE schemaname = t.schemaname 
     AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname IN ('public', 'users')
    AND tablename IN (
        'events', 'event_posts', 'tickets', 'orders',
        'user_profiles', 'organizations', 'org_memberships'
    )
ORDER BY rowsecurity ASC, tablename;
```

---

## 📋 Step 3: Test Scenarios for Each Table

### Table: `events`

**What it contains**: Event listings, details, visibility settings

**Expected Behavior**:
- ✅ Guest users can see public events
- ✅ Authenticated users can see public events
- ✅ Authenticated users can see events they're attending
- ❌ Users CANNOT see private events unless they have a ticket
- ✅ Organizers can edit their own events
- ❌ Users CANNOT edit events they don't own

**Test Cases**:
- [ ] Test 1: Guest can query public events
  ```sql
  -- Run as anonymous user (no auth)
  SELECT id, title, is_public FROM events WHERE is_public = true LIMIT 10;
  -- Expected: Returns public events only
  ```

- [ ] Test 2: Guest cannot query private events
  ```sql
  -- Run as anonymous user
  SELECT id, title FROM events WHERE is_public = false;
  -- Expected: Returns empty or error
  ```

- [ ] Test 3: Organizer can update their own event
  ```sql
  -- Run as event owner
  UPDATE events SET title = 'Test Title' WHERE id = '<organizer_event_id>' AND created_by = auth.uid();
  -- Expected: Success
  ```

- [ ] Test 4: User cannot update someone else's event
  ```sql
  -- Run as different user
  UPDATE events SET title = 'Hacked' WHERE id = '<other_organizer_event_id>';
  -- Expected: No rows updated or error
  ```

- [ ] Test 5: User with ticket can see private event
  ```sql
  -- Run as user with ticket
  SELECT e.* FROM events e
  JOIN tickets t ON t.event_id = e.id
  WHERE t.user_id = auth.uid() AND e.is_public = false;
  -- Expected: Returns events they have tickets for
  ```

**Current Policies Found**:
```
Policy Name: [Name]
Command: SELECT/INSERT/UPDATE/DELETE
Expression: [Policy expression]
Status: ✅ Working / ❌ Needs Fix / 🔴 Missing
```

**Issues Found**:
- [ ] Issue: [Description]
  - Severity: 🔴 Critical / 🟡 High / 🟢 Medium
  - Fix: [How to fix]

---

### Table: `event_posts`

**What it contains**: User-generated posts with media

**Expected Behavior**:
- ✅ All users can see posts for public events
- ✅ Users can only edit/delete their own posts
- ✅ Organizers can moderate posts in their events
- ❌ Users CANNOT delete others' posts

**Test Cases**:
- [ ] Test 1: Guest can see posts for public events
- [ ] Test 2: User can create a post
- [ ] Test 3: User can edit their own post
- [ ] Test 4: User cannot edit someone else's post
- [ ] Test 5: User can delete their own post
- [ ] Test 6: User cannot delete someone else's post
- [ ] Test 7: Organizer can see all posts in their events

**Current Policies Found**:
- [ ] Document policies here

**Issues Found**:
- [ ] Issue: [Description]

---

### Table: `tickets`

**What it contains**: Purchased tickets, user personal data

**Expected Behavior**:
- ✅ Users can only see their own tickets
- ✅ Organizers can see tickets for their events (for check-in)
- ❌ Users CANNOT see other users' tickets
- ❌ Users CANNOT modify ticket data

**Test Cases**:
- [ ] Test 1: User can see their own tickets
  ```sql
  -- Run as authenticated user
  SELECT * FROM tickets WHERE user_id = auth.uid();
  -- Expected: Returns only user's tickets
  ```

- [ ] Test 2: User cannot see other users' tickets
  ```sql
  -- Run as user A, try to query user B's tickets
  SELECT * FROM tickets WHERE user_id != auth.uid();
  -- Expected: Returns empty or only user A's tickets
  ```

- [ ] Test 3: Organizer can see tickets for their events
  ```sql
  -- Run as organizer
  SELECT t.* FROM tickets t
  JOIN events e ON e.id = t.event_id
  WHERE e.created_by = auth.uid();
  -- Expected: Returns tickets for organizer's events
  ```

- [ ] Test 4: User cannot update ticket status
  ```sql
  -- Run as ticket owner
  UPDATE tickets SET status = 'redeemed' WHERE id = '<ticket_id>';
  -- Expected: No rows updated or error (tickets should only be updated by system/check-in)
  ```

**Current Policies Found**:
- [ ] Document policies here

**Issues Found**:
- [ ] Issue: [Description]

---

### Table: `orders`

**What it contains**: Payment transactions, financial data

**Expected Behavior**:
- ✅ Users can only see their own orders
- ✅ Organizers can see orders for their events (for revenue tracking)
- ❌ Users CANNOT see other users' orders
- ❌ Users CANNOT modify orders

**Test Cases**:
- [ ] Test 1: User can see their own orders
- [ ] Test 2: User cannot see other users' orders
- [ ] Test 3: User cannot modify orders
- [ ] Test 4: Organizer can see orders for their events (read-only)

**Current Policies Found**:
- [ ] Document policies here

**Issues Found**:
- [ ] Issue: [Description]

---

### Table: `user_profiles`

**What it contains**: Personal user information

**Expected Behavior**:
- ✅ Users can read all public profiles
- ✅ Users can update their own profile
- ✅ Users can see private fields of their own profile
- ❌ Users CANNOT update other users' profiles
- ❌ Users CANNOT see private fields of other profiles

**Test Cases**:
- [ ] Test 1: User can read any public profile
- [ ] Test 2: User can update their own profile
- [ ] Test 3: User cannot update other users' profiles
- [ ] Test 4: User can see their own private fields
- [ ] Test 5: User cannot see private fields of others

**Current Policies Found**:
- [ ] Document policies here

**Issues Found**:
- [ ] Issue: [Description]

---

### Table: `organizations`

**What it contains**: Organizer organization data

**Expected Behavior**:
- ✅ Users can read public organization profiles
- ✅ Organization members can update their org (based on role)
- ❌ Users CANNOT update organizations they don't belong to

**Test Cases**:
- [ ] Test 1: User can read public organizations
- [ ] Test 2: Organization owner can update their org
- [ ] Test 3: Organization admin can update their org
- [ ] Test 4: Regular member cannot update org details
- [ ] Test 5: Non-member cannot update organization

**Current Policies Found**:
- [ ] Document policies here

**Issues Found**:
- [ ] Issue: [Description]

---

### Table: `org_memberships`

**What it contains**: Access control for organizations

**Expected Behavior**:
- ✅ Users can see memberships they belong to
- ✅ Organization owners/admins can see all members
- ❌ Users CANNOT see memberships they don't belong to
- ✅ Organization owners can add/remove members

**Test Cases**:
- [ ] Test 1: User can see their own memberships
- [ ] Test 2: User cannot see other users' memberships
- [ ] Test 3: Org owner can see all members
- [ ] Test 4: Org owner can add members
- [ ] Test 5: Regular user cannot add members

**Current Policies Found**:
- [ ] Document policies here

**Issues Found**:
- [ ] Issue: [Description]

---

## 📋 Step 4: Create Test Users

### Script: Create Test Users

```sql
-- Create test users in Supabase Dashboard or via SQL
-- We'll need to create these in Supabase Auth, then create profiles

-- Test User 1: Regular Attendee
-- Email: test.attendee@liventix.test
-- Password: Test123!@#
-- Role: attendee

-- Test User 2: Organizer
-- Email: test.organizer@liventix.test
-- Password: Test123!@#
-- Role: organizer

-- Test User 3: Another Attendee (for privacy tests)
-- Email: test.attendee2@liventix.test
-- Password: Test123!@#
-- Role: attendee
```

### Script: Create Test Data

```sql
-- Create test organization
INSERT INTO organizations (name, slug, ...) VALUES (...);

-- Create test event
INSERT INTO events (title, created_by, ...) VALUES (...);

-- Create test tickets
INSERT INTO tickets (user_id, event_id, ...) VALUES (...);
```

---

## 📋 Step 5: Automated Policy Verification

### Query: Check for Missing Policies

```sql
-- Find tables with RLS enabled but no policies
SELECT 
    schemaname || '.' || tablename as table_name,
    'RLS enabled but no policies!' as issue
FROM pg_tables t
WHERE schemaname IN ('public', 'users')
    AND rowsecurity = true
    AND NOT EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = t.schemaname
        AND p.tablename = t.tablename
    );
```

### Query: Check for Overly Permissive Policies

```sql
-- Find policies that allow all users (might be too permissive)
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE schemaname IN ('public', 'users')
    AND (qual IS NULL OR qual = 'true' OR qual = '')
ORDER BY tablename;
```

---

## 📋 Step 6: Document Findings

### Security Audit Report Template

**Date**: [Date]  
**Auditor**: [Name]  
**Scope**: All tables in public and users schemas

#### Summary
- Total tables audited: [Number]
- Tables with RLS enabled: [Number]
- Tables with RLS disabled: [Number] ⚠️
- Policies reviewed: [Number]
- Issues found: [Number]
  - Critical: [Number]
  - High: [Number]
  - Medium: [Number]

#### Critical Issues Found
1. [Issue description]
   - Table: [Table name]
   - Severity: 🔴 Critical
   - Impact: [What can go wrong]
   - Fix: [How to fix]

#### High Priority Issues
1. [Issue description]
   - Table: [Table name]
   - Severity: 🟡 High
   - Impact: [What can go wrong]
   - Fix: [How to fix]

#### Recommendations
1. [Recommendation]
2. [Recommendation]
3. [Recommendation]

---

## 📋 Step 7: Fix Issues

### Fix Template

For each issue found:

```sql
-- Issue: [Description]
-- Table: [Table name]
-- Current problem: [What's wrong]

-- Fix: Create/update policy
CREATE POLICY "[policy_name]" ON [table_name]
FOR [SELECT/INSERT/UPDATE/DELETE]
TO [authenticated/anonymous/role]
USING ([security expression]);

-- Test after fix:
-- [Test query to verify fix works]
```

---

## ✅ Audit Checklist

### Preparation
- [ ] Access to Supabase dashboard
- [ ] SQL query access
- [ ] Test user accounts created
- [ ] Test data created

### Execution
- [ ] Step 1: Inventory all tables
- [ ] Step 2: Check current RLS policies
- [ ] Step 3: Test each critical table
- [ ] Step 4: Document all findings
- [ ] Step 5: Create test users and data
- [ ] Step 6: Run automated checks

### Reporting
- [ ] Create security audit report
- [ ] Prioritize issues by severity
- [ ] Create fix plan for each issue
- [ ] Document test results

### Fixes
- [ ] Fix all critical issues
- [ ] Fix all high priority issues
- [ ] Fix medium priority issues
- [ ] Re-test after fixes
- [ ] Update documentation

---

## 🔗 Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Guide](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Common RLS Patterns](https://supabase.com/docs/guides/auth/row-level-security#policies)

---

*Update this document as we progress through the audit*


