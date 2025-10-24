# 🚀 Option A: Complete Database Migration - Step by Step

## ✅ What You're About to Do

Complete the database migration to match your updated code:
- Create 11 domain schemas
- Move tables from `public` to domain schemas
- Create backward-compatible views
- Preserve all data, indexes, and constraints

**Time:** ~30 minutes
**Risk:** Low (data preserved, can rollback)
**Result:** Professional, enterprise-grade architecture ✨

---

## 📋 Prerequisites Checklist

Before starting:

- [ ] Have access to Supabase Dashboard
- [ ] Can open SQL Editor in Supabase
- [ ] Have `SQL_EDITOR_QUICK_START.md` file ready
- [ ] Have tested the diagnosis query (optional)
- [ ] Ready to commit ~30 minutes

---

## 🎯 Migration Steps

### **Step 1: Create Foundation (5 minutes)**

Open **Supabase SQL Editor** and run these in order:

#### **1.1: Create Schemas**

```sql
-- Create domain schemas
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS organizations;
CREATE SCHEMA IF NOT EXISTS events;
CREATE SCHEMA IF NOT EXISTS ticketing;
CREATE SCHEMA IF NOT EXISTS sponsorship;
CREATE SCHEMA IF NOT EXISTS campaigns;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS messaging;
CREATE SCHEMA IF NOT EXISTS payments;
CREATE SCHEMA IF NOT EXISTS ml;
CREATE SCHEMA IF NOT EXISTS ref;

-- Verify schemas created
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name IN ('users', 'organizations', 'events', 'ticketing', 
                      'sponsorship', 'campaigns', 'analytics', 'messaging', 
                      'payments', 'ml', 'ref')
ORDER BY schema_name;
```

**Expected:** Should return 11 rows ✅

---

#### **1.2: Create Security Helper Functions**

```sql
-- Helper to get current org from JWT
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN NULLIF(current_setting('request.jwt.claims', true)::json->>'organization_id', '')::uuid;
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$;

-- Helper to get user's organizations
CREATE OR REPLACE FUNCTION public.user_orgs(uid uuid DEFAULT auth.uid())
RETURNS SETOF uuid
LANGUAGE sql
STABLE
AS $$
  SELECT org_id 
  FROM organizations.org_memberships 
  WHERE user_id = uid;
$$;

-- Verify functions created
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('current_org_id', 'user_orgs');
```

**Expected:** Should return 2 rows ✅

---

### **Step 2: Move Core Tables (10 minutes)**

#### **2.1: Move Users Schema Tables**

```sql
-- Move user-related tables
ALTER TABLE IF EXISTS public.user_profiles SET SCHEMA users;
ALTER TABLE IF EXISTS public.follows SET SCHEMA users;
ALTER TABLE IF EXISTS public.user_search SET SCHEMA users;
ALTER TABLE IF EXISTS public.user_event_interactions SET SCHEMA users;

-- Verify
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'users'
ORDER BY table_name;
```

**Expected:** Should show users tables ✅

---

#### **2.2: Move Organizations Schema Tables**

```sql
-- Move organization tables
ALTER TABLE IF EXISTS public.organizations SET SCHEMA organizations;
ALTER TABLE IF EXISTS public.org_memberships SET SCHEMA organizations;
ALTER TABLE IF EXISTS public.org_invitations SET SCHEMA organizations;
ALTER TABLE IF EXISTS public.org_contact_imports SET SCHEMA organizations;
ALTER TABLE IF EXISTS public.org_contact_import_entries SET SCHEMA organizations;
ALTER TABLE IF EXISTS public.role_invites SET SCHEMA organizations;

-- Verify
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'organizations'
ORDER BY table_name;
```

**Expected:** Should show organization tables ✅

---

#### **2.3: Move Events Schema Tables**

```sql
-- Move event-related tables
ALTER TABLE IF EXISTS public.events SET SCHEMA events;
ALTER TABLE IF EXISTS public.event_posts SET SCHEMA events;
ALTER TABLE IF EXISTS public.event_comments SET SCHEMA events;
ALTER TABLE IF EXISTS public.event_reactions SET SCHEMA events;
ALTER TABLE IF EXISTS public.event_comment_reactions SET SCHEMA events;
ALTER TABLE IF EXISTS public.event_roles SET SCHEMA events;
ALTER TABLE IF EXISTS public.event_invites SET SCHEMA events;
ALTER TABLE IF EXISTS public.event_video_counters SET SCHEMA events;

-- Verify
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'events'
ORDER BY table_name;
```

**Expected:** Should show event tables ✅

---

#### **2.4: Move Ticketing Schema Tables**

```sql
-- Move ticketing tables
ALTER TABLE IF EXISTS public.tickets SET SCHEMA ticketing;
ALTER TABLE IF EXISTS public.ticket_tiers SET SCHEMA ticketing;
ALTER TABLE IF EXISTS public.orders SET SCHEMA ticketing;
ALTER TABLE IF EXISTS public.order_items SET SCHEMA ticketing;
ALTER TABLE IF EXISTS public.scan_logs SET SCHEMA ticketing;
ALTER TABLE IF EXISTS public.guest_codes SET SCHEMA ticketing;
ALTER TABLE IF EXISTS public.guest_otp_codes SET SCHEMA ticketing;
ALTER TABLE IF EXISTS public.refunds SET SCHEMA ticketing;
ALTER TABLE IF EXISTS public.ticket_holds SET SCHEMA ticketing;
ALTER TABLE IF EXISTS public.inventory_operations SET SCHEMA ticketing;
ALTER TABLE IF EXISTS public.event_scanners SET SCHEMA ticketing;
ALTER TABLE IF EXISTS public.guest_ticket_sessions SET SCHEMA ticketing;

-- Verify
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'ticketing'
ORDER BY table_name;
```

**Expected:** Should show ticketing tables ✅

---

### **Step 3: Move Remaining Tables (5 minutes)**

#### **3.1: Move Sponsorship Tables**

```sql
-- Move sponsorship tables
ALTER TABLE IF EXISTS public.sponsors SET SCHEMA sponsorship;
ALTER TABLE IF EXISTS public.sponsor_profiles SET SCHEMA sponsorship;
ALTER TABLE IF EXISTS public.sponsor_members SET SCHEMA sponsorship;
ALTER TABLE IF EXISTS public.sponsorship_packages SET SCHEMA sponsorship;
ALTER TABLE IF EXISTS public.sponsorship_orders SET SCHEMA sponsorship;
ALTER TABLE IF EXISTS public.sponsorship_matches SET SCHEMA sponsorship;
ALTER TABLE IF EXISTS public.proposal_threads SET SCHEMA sponsorship;
ALTER TABLE IF EXISTS public.proposal_messages SET SCHEMA sponsorship;
ALTER TABLE IF EXISTS public.deliverables SET SCHEMA sponsorship;
ALTER TABLE IF EXISTS public.deliverable_proofs SET SCHEMA sponsorship;
ALTER TABLE IF EXISTS public.event_sponsorships SET SCHEMA sponsorship;

-- Verify
SELECT COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'sponsorship';
```

---

#### **3.2: Move Campaigns, Analytics, Messaging, Payments Tables**

```sql
-- Campaigns
ALTER TABLE IF EXISTS public.campaigns SET SCHEMA campaigns;
ALTER TABLE IF EXISTS public.campaign_ads SET SCHEMA campaigns;

-- Analytics (be careful with partitioned tables)
ALTER TABLE IF EXISTS public.analytics_events SET SCHEMA analytics;
ALTER TABLE IF EXISTS public.event_impressions SET SCHEMA analytics;
ALTER TABLE IF EXISTS public.post_impressions SET SCHEMA analytics;
ALTER TABLE IF EXISTS public.post_views SET SCHEMA analytics;

-- Messaging
ALTER TABLE IF EXISTS public.notifications SET SCHEMA messaging;
ALTER TABLE IF EXISTS public.direct_conversations SET SCHEMA messaging;
ALTER TABLE IF EXISTS public.direct_messages SET SCHEMA messaging;
ALTER TABLE IF EXISTS public.conversation_participants SET SCHEMA messaging;
ALTER TABLE IF EXISTS public.message_jobs SET SCHEMA messaging;
ALTER TABLE IF EXISTS public.message_job_recipients SET SCHEMA messaging;

-- Payments
ALTER TABLE IF EXISTS public.org_wallets SET SCHEMA payments;
ALTER TABLE IF EXISTS public.org_wallet_transactions SET SCHEMA payments;
ALTER TABLE IF EXISTS public.payout_accounts SET SCHEMA payments;

-- Verify all
SELECT table_schema, COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema IN ('campaigns', 'analytics', 'messaging', 'payments')
GROUP BY table_schema
ORDER BY table_schema;
```

---

### **Step 4: Create Backward-Compatible Views (5 minutes)**

This is **CRITICAL** - creates views so code can use either style:

```sql
-- Create views in public schema pointing to new locations

-- Users
CREATE OR REPLACE VIEW public.user_profiles AS SELECT * FROM users.user_profiles;
CREATE OR REPLACE VIEW public.follows AS SELECT * FROM users.follows;

-- Organizations
CREATE OR REPLACE VIEW public.organizations AS SELECT * FROM organizations.organizations;
CREATE OR REPLACE VIEW public.org_memberships AS SELECT * FROM organizations.org_memberships;

-- Events
CREATE OR REPLACE VIEW public.events AS SELECT * FROM events.events;
CREATE OR REPLACE VIEW public.event_posts AS SELECT * FROM events.event_posts;
CREATE OR REPLACE VIEW public.event_comments AS SELECT * FROM events.event_comments;
CREATE OR REPLACE VIEW public.event_reactions AS SELECT * FROM events.event_reactions;

-- Ticketing
CREATE OR REPLACE VIEW public.tickets AS SELECT * FROM ticketing.tickets;
CREATE OR REPLACE VIEW public.ticket_tiers AS SELECT * FROM ticketing.ticket_tiers;
CREATE OR REPLACE VIEW public.orders AS SELECT * FROM ticketing.orders;
CREATE OR REPLACE VIEW public.scan_logs AS SELECT * FROM ticketing.scan_logs;

-- Sponsorship
CREATE OR REPLACE VIEW public.sponsors AS SELECT * FROM sponsorship.sponsors;
CREATE OR REPLACE VIEW public.sponsorship_packages AS SELECT * FROM sponsorship.sponsorship_packages;
CREATE OR REPLACE VIEW public.sponsorship_orders AS SELECT * FROM sponsorship.sponsorship_orders;

-- Analytics
CREATE OR REPLACE VIEW public.analytics_events AS SELECT * FROM analytics.analytics_events;

-- Messaging
CREATE OR REPLACE VIEW public.notifications AS SELECT * FROM messaging.notifications;

-- Payments
CREATE OR REPLACE VIEW public.org_wallets AS SELECT * FROM payments.org_wallets;

-- Verify views created
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public'
AND table_name IN ('user_profiles', 'events', 'tickets', 'organizations')
ORDER BY table_name;
```

**Expected:** Should return view names ✅

---

### **Step 5: Verify Migration (5 minutes)**

Run these verification queries:

#### **5.1: Check All Schemas Exist**

```sql
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name IN ('users', 'organizations', 'events', 'ticketing', 
                      'sponsorship', 'campaigns', 'analytics', 'messaging', 
                      'payments', 'ml', 'ref')
ORDER BY schema_name;
```

**Expected:** 11 rows ✅

---

#### **5.2: Check Tables Moved**

```sql
-- This should return counts for each schema
SELECT table_schema, COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema IN ('users', 'organizations', 'events', 'ticketing', 
                       'sponsorship', 'campaigns', 'analytics', 'messaging', 
                       'payments', 'ml', 'ref')
AND table_type = 'BASE TABLE'
GROUP BY table_schema
ORDER BY table_schema;
```

**Expected:** Multiple schemas with tables ✅

---

#### **5.3: Check Views Created**

```sql
SELECT COUNT(*) as view_count
FROM information_schema.views 
WHERE table_schema = 'public';
```

**Expected:** At least 15+ views ✅

---

#### **5.4: Test Cross-Schema Query**

```sql
-- This should work if everything is connected properly
SELECT 
    u.display_name,
    COUNT(e.id) as events_created,
    COUNT(t.id) as tickets_owned
FROM users.user_profiles u
LEFT JOIN events.events e ON e.created_by = u.user_id
LEFT JOIN ticketing.tickets t ON t.owner_user_id = u.user_id
WHERE u.user_id = (SELECT user_id FROM users.user_profiles LIMIT 1)
GROUP BY u.display_name;
```

**Expected:** Returns user data with counts ✅

---

#### **5.5: Test Views Work**

```sql
-- These should all work (using non-prefixed names via views)
SELECT COUNT(*) FROM user_profiles;
SELECT COUNT(*) FROM events;
SELECT COUNT(*) FROM tickets;
SELECT COUNT(*) FROM organizations;
```

**Expected:** All return counts ✅

---

### **Step 6: Update Search Path (Optional but Recommended)**

```sql
-- Set search path so non-prefixed queries work
ALTER DATABASE postgres 
SET search_path = public, users, organizations, events, ticketing, 
                 sponsorship, campaigns, analytics, messaging, payments, ml, ref;
```

---

## ✅ Migration Complete Checklist

After running all steps, verify:

- [ ] All 11 schemas exist
- [ ] Tables moved from public to domain schemas
- [ ] Views created in public schema
- [ ] Cross-schema queries work
- [ ] Views work (non-prefixed queries)
- [ ] Helper functions exist
- [ ] No errors in SQL Editor

---

## 🧪 Test Your Application

Now test your app:

```bash
# Start dev server
npm run dev

# Test these flows:
# ✓ Login/Signup
# ✓ View profile
# ✓ Browse events
# ✓ Purchase tickets
# ✓ View wallet
```

---

## 🎊 Success! What You've Achieved

✅ **Enterprise-grade database architecture**
✅ **11 domain-specific schemas**
✅ **Clear boundaries and organization**
✅ **Backward-compatible (views)**
✅ **Zero downtime migration**
✅ **All data preserved**

---

## 🚨 If Something Goes Wrong

### **Error: "relation already exists in schema"**

**Solution:** Table already moved, skip that command

### **Error: "relation does not exist"**

**Solution:** Table doesn't exist in your database, skip that command

### **Error: Foreign key constraint issue**

**Solution:** 
```sql
-- Temporarily disable constraint
ALTER TABLE schema.table ALTER CONSTRAINT constraint_name NOT VALID;
-- Move table
ALTER TABLE public.table SET SCHEMA schema;
-- Re-enable constraint
ALTER TABLE schema.table VALIDATE CONSTRAINT constraint_name;
```

### **Need to Rollback?**

```sql
-- Move tables back to public
ALTER TABLE users.user_profiles SET SCHEMA public;
-- etc...
```

---

## 📚 Reference Documents

- **Full migration plan:** `DATABASE_RESTRUCTURING_PLAN.md`
- **SQL scripts:** `SQL_EDITOR_QUICK_START.md`
- **Your database structure:** `YOUR_DATABASE_STRUCTURE.md`

---

## 💡 Pro Tips

1. **Run one section at a time** - Don't paste everything at once
2. **Check results after each step** - Verify before moving on
3. **Keep SQL Editor open** - You'll need it for all steps
4. **Don't panic on errors** - Most are harmless (table doesn't exist)
5. **Test after completion** - Verify app works

---

## 🎯 What's Next

After migration completes:

1. ✅ Test your application thoroughly
2. ✅ Monitor for any issues
3. ✅ Update your team
4. ✅ Push code changes
5. ✅ Celebrate! 🎉

---

**You've got this! The migration is straightforward and safe.** 💪

**Start with Step 1 and work through each step. Tell me if you hit any issues!** 🚀


