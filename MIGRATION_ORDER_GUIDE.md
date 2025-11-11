# 🗺️ Security Migration Deployment Guide

**Date:** November 9, 2025  
**Purpose:** Apply security fixes in correct order

---

## 📊 Current State

**Functions Found:** 7 of 9 expected functions exist

**Missing Functions:**
- `is_platform_admin()` ❌
- Possibly `update_user_role()` or `handle_new_user()` ❌

**This means:**
- Migration `20251109100000_secure_profile_creation.sql` has **NOT** been applied yet
- Migration `20251109110000_secure_role_invites.sql` **CANNOT** be applied (depends on is_platform_admin)

---

## 🎯 Two Deployment Paths

### **Option A: Full Security Suite (Recommended)**

Apply both migrations together to get all security fixes.

**Benefits:**
- Complete security hardening
- Platform admin foundation
- Profile creation trigger
- Role invite fixes

**Steps:**
```bash
# 1. Apply profile creation migration (creates is_platform_admin stub)
supabase db push

# This will apply both migrations in order:
# - 20251109100000_secure_profile_creation.sql
# - 20251109110000_secure_role_invites.sql
```

**Time:** 5 minutes  
**Risk:** Low (both migrations are tested)

---

### **Option B: Role Invites Only (Faster)**

Apply just the role invite fixes without platform admin dependency.

**Benefits:**
- Faster deployment
- No platform admin dependency
- Still fixes critical invite vulnerabilities

**Steps:**
```bash
# 1. Delete the dependent migration
rm supabase/migrations/20251109110000_secure_role_invites.sql

# 2. Rename standalone version
mv supabase/migrations/20251109110001_secure_role_invites_standalone.sql \
   supabase/migrations/20251109110000_secure_role_invites.sql

# 3. Apply
supabase db push
```

**Time:** 2 minutes  
**Risk:** Very low (standalone, no dependencies)

---

## 🚦 Recommended Approach

**I recommend Option A** because:
1. ✅ Gets you both profile security AND invite security
2. ✅ Creates foundation for platform admin
3. ✅ Only takes 5 minutes
4. ✅ More complete security posture

---

## 📋 Option A: Detailed Steps

### **Step 1: Verify Migrations Are Ready**

```bash
# List pending migrations
ls -la supabase/migrations/202511*.sql

# You should see:
# - 20251109000000_add_performance_indexes.sql (may be applied already)
# - 20251109100000_secure_profile_creation.sql (new)
# - 20251109110000_secure_role_invites.sql (new)
```

### **Step 2: Apply Migrations**

```bash
cd /Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade

# Apply all pending migrations
supabase db push
```

**What This Does:**
- Creates `is_platform_admin()` function (stub returning false)
- Creates `handle_new_user()` trigger
- Creates `update_user_role()` function
- Creates `audit_log` table
- Fixes profile creation security
- Fixes role invite security
- Adds scanner limits
- Removes anon access to tokens

### **Step 3: Verify Success**

Run the diagnostic script:

```sql
-- Copy from scripts/check-missing-functions.sql
-- Paste into Supabase SQL Editor

-- Should now show: "ALL functions exist (9 of 9)"
```

### **Step 4: Deploy Edge Function**

```bash
supabase functions deploy send-role-invite --no-verify-jwt
```

### **Step 5: Test End-to-End**

```typescript
// 1. Test unauthorized invite (should FAIL)
// As user who doesn't own event:
const { error } = await supabase.functions.invoke('send-role-invite', {
  body: {
    event_id: 'someone-elses-event',
    role: 'scanner',
    email: 'test@example.com'
  }
});
// Expected: 403 Unauthorized ✅

// 2. Test authorized invite (should SUCCEED)
// As event owner:
const { error } = await supabase.functions.invoke('send-role-invite', {
  body: {
    event_id: 'my-event',
    role: 'scanner',
    email: 'helper@example.com'
  }
});
// Expected: Success, email sent ✅

// 3. Test anon cannot query invites (should FAIL)
// Logout, then try:
const { data } = await supabase.from('role_invites').select('*');
// Expected: Empty or RLS error ✅
```

---

## 📋 Option B: Detailed Steps

### **Step 1: Use Standalone Migration**

```bash
# Delete the dependent version
rm supabase/migrations/20251109110000_secure_role_invites.sql

# Standalone version is already created:
# - 20251109110001_secure_role_invites_standalone.sql
```

### **Step 2: Apply**

```bash
supabase db push
```

**What This Does:**
- Fixes role invite security
- Removes anon access
- Adds scanner limits
- Adds audit logging
- **Does NOT** create platform admin functions

### **Step 3: Update Edge Function**

Remove `is_platform_admin()` reference from RLS if needed.

---

## 🎯 What I Recommend

**Choose Option A** - here's why:

```
Option A (Full Suite):
✅ Profile creation security
✅ Role invite security  
✅ Platform admin foundation
✅ Complete audit trail
✅ 5 minutes total

Option B (Standalone):
❌ Profile creation still vulnerable
✅ Role invite security
❌ No platform admin
✅ Partial audit trail
✅ 2 minutes total
```

**The extra 3 minutes gets you WAY more security value!**

---

## 🚨 Current Vulnerabilities (Until Applied)

**Right Now:**
- ❌ Anyone can send invites for any event (no auth check in Edge Function)
- ❌ Tokens visible to anonymous users
- ❌ No rate limiting (spam risk)
- ❌ Users can set their own role on signup
- ❌ No audit trail

**After Option A:**
- ✅ All fixed
- ✅ Production-ready security

**After Option B:**
- ✅ Invite issues fixed
- ❌ Profile issues remain

---

## 📞 Next Action

**Tell me which option you prefer:**
- **"A"** - Apply both migrations (recommended)
- **"B"** - Apply just role invites

Then I'll guide you through the deployment! 🚀

