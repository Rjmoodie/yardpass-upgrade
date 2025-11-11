# 🚨 CRITICAL: Apply Profile Security Fix NOW

**Status:** 🔴 **CRITICAL VULNERABILITY ACTIVE**  
**Risk:** Users can promote themselves to 'organizer'  
**Action:** Apply migration immediately

---

## ⚠️ Current Vulnerability

Your database has this policy:
```sql
"own_profile_all" FOR ALL USING (user_id = auth.uid())
```

**This allows ANY user to:**
```typescript
// Promote themselves to organizer:
await supabase
  .from('user_profiles')
  .update({ role: 'organizer' })
  .eq('user_id', user.id);

// ❌ THIS WORKS RIGHT NOW!
```

---

## ✅ Fix: Apply Secure Migration

### **Step 1: Apply Fixed Migration**

```bash
cd /Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade

# Apply the fixed version:
supabase db push
```

**Migration to apply:** `20251109100001_secure_profile_creation_fixed.sql`

**What it does:**
1. Drops all insecure policies (including "own_profile_all")
2. Creates secure policies that block role changes
3. Adds `handle_new_user()` function (SECURITY DEFINER)
4. Adds `update_user_role()` function (server-controlled)
5. Updates trigger to use secure function

---

### **Step 2: Verify**

```sql
-- Run in Supabase SQL Editor:

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'user_profiles' 
        AND policyname = 'user_profiles_update_restricted'
    )
    THEN '✅ SECURE POLICY ACTIVE'
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'user_profiles' 
        AND policyname = 'own_profile_all'
    )
    THEN '❌ INSECURE POLICY STILL ACTIVE!'
    ELSE '⚠️ UNKNOWN STATE'
  END as status;
```

**Expected:** `✅ SECURE POLICY ACTIVE`

---

### **Step 3: Test (Critical)**

```typescript
// Try to promote yourself (should FAIL):
const { error } = await supabase
  .from('user_profiles')
  .update({ role: 'organizer' })
  .eq('user_id', user.id);

console.log(error);
// Expected: RLS violation or "role must match current role"
```

---

## 🎯 Why This is Critical

**Current Risk:**
- Any user can become organizer
- Can then create events
- Can access organizer dashboard
- Can invite others
- **Full privilege escalation**

**After Fix:**
- Role field locked
- Only server can change via `update_user_role()`
- Admin-only (or verification required)
- **Privilege escalation impossible**

---

## 📋 Quick Commands

```bash
# 1. Apply migration
cd /Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade
supabase db push

# 2. Check success (should be in output)
# Look for: "✅ Migration complete"

# 3. Verify in SQL editor (paste verification query above)
```

---

**This is a critical security fix. Please apply immediately!** 🚨

**Status after applying:** 🟢 **Fully Secured**

