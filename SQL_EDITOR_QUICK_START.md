# 🚀 Supabase SQL Editor - Quick Start Guide

> **Where to run:** Supabase Dashboard → SQL Editor → New Query

---

## 📋 Phase 1: Foundation (Run These First)

### Step 1: Create All Schemas

```sql
-- Create all domain schemas
CREATE SCHEMA IF NOT EXISTS ref;
CREATE SCHEMA IF NOT EXISTS campaigns;
CREATE SCHEMA IF NOT EXISTS events;
CREATE SCHEMA IF NOT EXISTS ticketing;
CREATE SCHEMA IF NOT EXISTS sponsorship;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS messaging;
CREATE SCHEMA IF NOT EXISTS organizations;
CREATE SCHEMA IF NOT EXISTS users;
CREATE SCHEMA IF NOT EXISTS payments;
CREATE SCHEMA IF NOT EXISTS ml;

-- Verify schemas were created
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name IN (
  'ref', 'campaigns', 'events', 'ticketing', 'sponsorship', 
  'analytics', 'messaging', 'organizations', 'users', 'payments', 'ml'
)
ORDER BY schema_name;
```

**Expected result:** Should return 11 rows (all your new schemas)

---

### Step 2: Create Roles

```sql
-- Create role hierarchy
CREATE ROLE app_read NOLOGIN;
CREATE ROLE app_write NOLOGIN;

-- Grant roles to Supabase built-in roles
GRANT app_read TO authenticated, anon;
GRANT app_write TO service_role;

-- Verify roles were created
SELECT rolname 
FROM pg_roles 
WHERE rolname IN ('app_read', 'app_write');
```

**Expected result:** 2 rows (app_read, app_write)

---

### Step 3: Create Security Helper Functions

```sql
-- Function to get current organization from JWT
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
SECURITY DEFINER
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() ->> 'org_id')::uuid
$$;

-- Function to get all user's organizations
CREATE OR REPLACE FUNCTION public.user_orgs()
RETURNS SETOF uuid
SECURITY DEFINER
LANGUAGE sql
STABLE
AS $$
  SELECT org_id 
  FROM public.org_memberships 
  WHERE user_id = auth.uid()
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.user_orgs() TO authenticated, anon;

-- Test the functions (should return null if you're not logged in as org member)
SELECT public.current_org_id();
SELECT * FROM public.user_orgs();
```

**Expected result:** Functions created, test returns NULL (ok for now)

---

### Step 4: Create Outbox Table

```sql
-- Create outbox for reliable webhooks
CREATE TABLE IF NOT EXISTS public.outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempt_count int NOT NULL DEFAULT 0,
  last_error text,
  
  CHECK (topic IS NOT NULL AND topic != '')
);

-- Index for unprocessed messages
CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed 
  ON public.outbox (created_at) 
  WHERE processed_at IS NULL;

-- Verify
SELECT * FROM public.outbox LIMIT 1;
```

**Expected result:** Table created, returns 0 rows (empty)

---

## 📊 Phase 2: Load Reference Data

### Step 5: Create Reference Tables

```sql
-- Countries (ISO 3166-1 alpha-2)
CREATE TABLE IF NOT EXISTS ref.countries (
  code char(2) PRIMARY KEY,
  name text NOT NULL,
  phone_prefix text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Currencies (ISO 4217)
CREATE TABLE IF NOT EXISTS ref.currencies (
  code char(3) PRIMARY KEY,
  name text NOT NULL,
  symbol text,
  decimal_places int NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Industries
CREATE TABLE IF NOT EXISTS ref.industries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Event categories
CREATE TABLE IF NOT EXISTS ref.event_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  parent_id uuid REFERENCES ref.event_categories(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Timezones
CREATE TABLE IF NOT EXISTS ref.timezones (
  name text PRIMARY KEY,
  offset_minutes int NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

### Step 6: Load Sample Reference Data

```sql
-- Load currencies
INSERT INTO ref.currencies (code, name, symbol, decimal_places) VALUES
  ('USD', 'US Dollar', '$', 2),
  ('EUR', 'Euro', '€', 2),
  ('GBP', 'British Pound', '£', 2),
  ('CAD', 'Canadian Dollar', 'CA$', 2),
  ('AUD', 'Australian Dollar', 'A$', 2),
  ('JPY', 'Japanese Yen', '¥', 0)
ON CONFLICT (code) DO NOTHING;

-- Load countries (sample)
INSERT INTO ref.countries (code, name, phone_prefix) VALUES
  ('US', 'United States', '+1'),
  ('CA', 'Canada', '+1'),
  ('GB', 'United Kingdom', '+44'),
  ('AU', 'Australia', '+61'),
  ('FR', 'France', '+33'),
  ('DE', 'Germany', '+49'),
  ('MX', 'Mexico', '+52')
ON CONFLICT (code) DO NOTHING;

-- Load industries (sample)
INSERT INTO ref.industries (name, description) VALUES
  ('Technology', 'Software, hardware, IT services'),
  ('Finance', 'Banking, insurance, investment'),
  ('Healthcare', 'Medical, pharmaceutical, wellness'),
  ('Retail', 'Consumer goods, e-commerce'),
  ('Food & Beverage', 'Restaurants, catering, CPG'),
  ('Entertainment', 'Media, gaming, events'),
  ('Sports', 'Athletics, fitness, sporting goods'),
  ('Automotive', 'Vehicles, parts, services')
ON CONFLICT (name) DO NOTHING;

-- Load event categories (sample)
INSERT INTO ref.event_categories (name, parent_id) VALUES
  ('Sports', NULL),
  ('Music', NULL),
  ('Arts', NULL),
  ('Community', NULL),
  ('Business', NULL)
ON CONFLICT (name) DO NOTHING;

-- Load timezones (sample)
INSERT INTO ref.timezones (name, offset_minutes, description) VALUES
  ('America/New_York', -300, 'Eastern Time (US & Canada)'),
  ('America/Chicago', -360, 'Central Time (US & Canada)'),
  ('America/Denver', -420, 'Mountain Time (US & Canada)'),
  ('America/Los_Angeles', -480, 'Pacific Time (US & Canada)'),
  ('Europe/London', 0, 'Greenwich Mean Time'),
  ('Europe/Paris', 60, 'Central European Time'),
  ('Australia/Sydney', 660, 'Australian Eastern Time')
ON CONFLICT (name) DO NOTHING;

-- Verify data loaded
SELECT 'currencies' as table_name, COUNT(*) as rows FROM ref.currencies
UNION ALL
SELECT 'countries', COUNT(*) FROM ref.countries
UNION ALL
SELECT 'industries', COUNT(*) FROM ref.industries
UNION ALL
SELECT 'event_categories', COUNT(*) FROM ref.event_categories
UNION ALL
SELECT 'timezones', COUNT(*) FROM ref.timezones;
```

**Expected result:** Shows row counts for each reference table

---

## 🔒 Phase 3: Grant Permissions

### Step 7: Grant Schema-Level Permissions

```sql
-- Grant permissions for all schemas
DO $$ 
DECLARE 
  schema_name text;
BEGIN
  FOREACH schema_name IN ARRAY ARRAY[
    'ref', 'campaigns', 'events', 'ticketing', 'sponsorship', 
    'analytics', 'messaging', 'organizations', 'users', 'payments', 'ml'
  ]
  LOOP
    -- Grant schema usage
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO app_read, app_write', schema_name);
    
    -- Grant SELECT to app_read
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO app_read', schema_name);
    EXECUTE format('GRANT SELECT ON ALL SEQUENCES IN SCHEMA %I TO app_read', schema_name);
    
    -- Grant full CRUD to app_write
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA %I TO app_write', schema_name);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO app_write', schema_name);
    
    -- Set default privileges for future objects
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON TABLES TO app_read', schema_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT ON SEQUENCES TO app_read', schema_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_write', schema_name);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT USAGE, SELECT ON SEQUENCES TO app_write', schema_name);
  END LOOP;
END $$;

-- Special case: ref schema is read-only
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ref FROM app_write;
ALTER DEFAULT PRIVILEGES IN SCHEMA ref
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM app_write;
```

**Expected result:** REVOKE statements execute successfully

---

### Step 8: Set Search Path

```sql
-- Set search path for convenience (so you can write "SELECT * FROM events" instead of "events.events")
ALTER ROLE authenticated IN DATABASE postgres
  SET search_path = public, ref, users, events, ticketing, sponsorship, campaigns, analytics, messaging, organizations, payments, ml;

ALTER ROLE anon IN DATABASE postgres
  SET search_path = public, ref;

ALTER ROLE service_role IN DATABASE postgres
  SET search_path = public, ref, users, events, ticketing, sponsorship, campaigns, analytics, messaging, organizations, payments, ml;

-- Verify search path (reconnect to see changes)
SHOW search_path;
```

**Expected result:** Shows your current search path

---

## 🧪 Phase 4: Test Setup

### Step 9: Verify Everything Works

```sql
-- 1. Check schemas exist
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name IN (
  'ref', 'campaigns', 'events', 'ticketing', 'sponsorship', 
  'analytics', 'messaging', 'organizations', 'users', 'payments', 'ml', 'public'
)
ORDER BY schema_name;

-- 2. Check roles exist
SELECT rolname, rolcanlogin 
FROM pg_roles 
WHERE rolname IN ('app_read', 'app_write', 'authenticated', 'anon', 'service_role');

-- 3. Check reference data loaded
SELECT 
  (SELECT COUNT(*) FROM ref.currencies) as currencies,
  (SELECT COUNT(*) FROM ref.countries) as countries,
  (SELECT COUNT(*) FROM ref.industries) as industries,
  (SELECT COUNT(*) FROM ref.event_categories) as event_categories,
  (SELECT COUNT(*) FROM ref.timezones) as timezones;

-- 4. Check functions exist
SELECT proname, proowner::regrole 
FROM pg_proc 
WHERE proname IN ('current_org_id', 'user_orgs');

-- 5. Check outbox table exists
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name = 'outbox';
```

**Expected results:**
- 12 schemas
- 5 roles
- Reference data counts
- 2 functions
- 1 outbox table

---

## 📋 What You Just Did

✅ **Created 11 domain schemas** (ref, campaigns, events, etc.)
✅ **Created role hierarchy** (app_read, app_write)
✅ **Created security functions** (current_org_id, user_orgs)
✅ **Created outbox table** (for reliable webhooks)
✅ **Loaded reference data** (currencies, countries, industries)
✅ **Granted permissions** (schema-level, future-proof)
✅ **Set search path** (convenience)

---

## 🎯 Next Steps (Do NOT Run Yet - Just for Info)

### After Phase 1-4 Complete, You Can Start Migrating Tables:

#### Example: Move `user_profiles` to `users` schema

```sql
-- ⚠️ DON'T RUN THIS YET - Just an example of what comes next

BEGIN;

-- 1. Move table
ALTER TABLE public.user_profiles SET SCHEMA users;

-- 2. Move sequences
ALTER SEQUENCE public.user_profiles_id_seq SET SCHEMA users;

-- 3. Create backward-compatible view
CREATE VIEW public.user_profiles AS SELECT * FROM users.user_profiles;

-- 4. Enable RLS
ALTER TABLE users.user_profiles ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policy
CREATE POLICY own_profile_select
  ON users.user_profiles
  FOR SELECT
  USING (user_id = auth.uid());

COMMIT;
```

---

## 🐛 Troubleshooting

### "Permission denied for schema X"
→ Make sure you ran Step 7 (Grant Permissions)

### "Function current_org_id() does not exist"
→ Run Step 3 again

### "Schema ref already exists"
→ That's ok! `CREATE SCHEMA IF NOT EXISTS` is safe to run multiple times

### "Search path not updated"
→ You need to **reconnect** to your database session to see the new search_path

### "No data returned from reference tables"
→ Run Step 6 again to load reference data

---

## 📚 What to Read Next

1. **Before migrating tables:** Read `DATABASE_RESTRUCTURING_PLAN.md` section on "Migration Strategy"
2. **To understand the schema structure:** Read `DB_SCHEMA_ARCHITECTURE.md`
3. **For step-by-step migration:** Follow `QUICK_DB_MIGRATION_CHECKLIST.md`

---

## ✅ Checklist

Copy this into your notes and check off as you go:

- [ ] Phase 1: Foundation
  - [ ] Step 1: Create schemas
  - [ ] Step 2: Create roles
  - [ ] Step 3: Create security functions
  - [ ] Step 4: Create outbox table

- [ ] Phase 2: Reference Data
  - [ ] Step 5: Create reference tables
  - [ ] Step 6: Load reference data

- [ ] Phase 3: Permissions
  - [ ] Step 7: Grant schema permissions
  - [ ] Step 8: Set search path

- [ ] Phase 4: Testing
  - [ ] Step 9: Verify everything works

**Once all checked, you're ready to start migrating tables!** 🚀

---

## 🔗 Quick Links

- **Full Migration Guide:** `DATABASE_RESTRUCTURING_PLAN.md`
- **Architecture Diagrams:** `DB_SCHEMA_ARCHITECTURE.md`
- **Daily Checklist:** `QUICK_DB_MIGRATION_CHECKLIST.md`
- **Navigation:** `RESTRUCTURING_INDEX.md`

---

**Pro tip:** Save each phase as a separate SQL snippet in Supabase for easy re-running!

