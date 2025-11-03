# 🔍 Guest OTP Tables - Diagnostic Instructions

## 🚨 The Issue

The error shows:
```
Could not find the table 'public.guest_otp_codes' in the schema cache
Perhaps you meant the table 'public.guest_codes'
```

This means the table either:
- ❌ Doesn't exist at all
- ✅ Exists in `ticketing` schema (not `public`)
- ✅ Needs a view/alias in `public` schema

---

## 🔍 Step 1: Check What Exists

### **Option A: Via Supabase Dashboard**

1. Go to: **Supabase Dashboard > Table Editor**
2. Look for these tables:
   - `guest_otp_codes`
   - `guest_ticket_sessions`
3. Note which **schema** they're in (look at the schema dropdown)

### **Option B: Via SQL Editor**

1. Go to: **Supabase Dashboard > SQL Editor**
2. Create new query
3. Paste and run: `check-guest-tables.sql`
4. Check the results

---

## 📊 Expected Results:

### **Scenario 1: Tables in `ticketing` schema**
```sql
table_schema | table_name
-------------|------------------
ticketing    | guest_otp_codes
ticketing    | guest_ticket_sessions
```

**Solution:** Create views in public schema (Option A below)

### **Scenario 2: Tables don't exist**
```sql
(no results)
```

**Solution:** Run the migration to create tables (Option B below)

### **Scenario 3: Tables in `public` schema**
```sql
table_schema | table_name
-------------|------------------
public       | guest_otp_codes
public       | guest_ticket_sessions
```

**Solution:** Already correct, just need to deploy functions (Option C below)

---

## ✅ Solution Based on Results:

### **Option A: If tables exist in `ticketing` schema**

The functions need to access them via `public`. Create views:

```sql
-- Create views in public schema pointing to ticketing schema
CREATE OR REPLACE VIEW public.guest_otp_codes AS
SELECT * FROM ticketing.guest_otp_codes;

CREATE OR REPLACE VIEW public.guest_ticket_sessions AS
SELECT * FROM ticketing.guest_ticket_sessions;

-- Grant permissions
GRANT ALL ON public.guest_otp_codes TO service_role;
GRANT ALL ON public.guest_ticket_sessions TO service_role;
```

Then deploy the functions:
```bash
./deploy-all-guest-fixes.sh
```

---

### **Option B: If tables DON'T exist**

Run the migration to create them:

```bash
# Apply the migration
./apply-guest-migration.sh

# Or manually via SQL Editor:
# Copy contents of: supabase/migrations/20251102_create_guest_otp_tables.sql
# Paste in SQL Editor and run
```

Then deploy the functions:
```bash
./deploy-all-guest-fixes.sh
```

---

### **Option C: If tables exist in `public` schema**

Tables are already correct, just deploy the updated functions:

```bash
./deploy-all-guest-fixes.sh
```

---

## 🧪 After Fix - Test:

1. Open auth modal
2. Click "Guest Access" tab
3. Enter email
4. Click "Send access code"
5. Check email for OTP
6. Enter OTP and verify
7. Should work without 400 error!

---

## 📋 Quick Check Commands

Run these in SQL Editor to verify:

```sql
-- Quick check #1: Does table exist?
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'guest_otp_codes'
);

-- Quick check #2: Which schema?
SELECT table_schema 
FROM information_schema.tables 
WHERE table_name = 'guest_otp_codes';

-- Quick check #3: Can service role access it?
SELECT 
  grantee, 
  privilege_type 
FROM information_schema.role_table_grants 
WHERE table_name = 'guest_otp_codes' 
  AND grantee = 'service_role';
```

---

## 🎯 Most Likely Scenario:

Based on `complete_database.sql` showing `ticketing.guest_otp_codes`, the table probably exists in the `ticketing` schema.

**Recommended action:** Run Option A (create views) to avoid duplicating data.

