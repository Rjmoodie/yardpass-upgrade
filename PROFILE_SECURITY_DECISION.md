# 🔍 Profile Security - Current State Analysis

**Status:** 🟡 PARTIAL (Trigger exists, functions may be missing)  
**Action Needed:** Determine if existing trigger is secure

---

## 📊 What We Know

**From Diagnostic:**
```
✅ on_auth_user_created trigger: EXISTS
❌ handle_new_user() function: MISSING (or different name)
❌ update_user_role() function: MISSING
```

**This means:**
- Someone created a profile trigger in the past
- BUT the security functions we want to add are missing
- Need to check if existing trigger is secure

---

## 🔍 Step 1: Inspect Current Trigger

**Run this in Supabase SQL Editor:**

```sql
-- Copy from: scripts/inspect-current-trigger.sql

-- This will show:
-- 1. What function the trigger calls
-- 2. Whether that function is SECURITY DEFINER
-- 3. What the function actually does
-- 4. Current RLS policies
```

---

## 🎯 Step 2: Evaluate Security

### **After running inspection, check for these red flags:**

❌ **Red Flag 1:** Function is NOT `SECURITY DEFINER`
```sql
-- If you see:
prosecdef: false  -- ❌ BAD (client can bypass)

-- Need:
prosecdef: true   -- ✅ GOOD (server-controlled)
```

❌ **Red Flag 2:** Function allows client to set `role`
```sql
-- If function contains something like:
role := NEW.raw_user_meta_data->>'role'  -- ❌ Client controlled!

-- Need:
role := 'attendee'  -- ✅ Always attendee
```

❌ **Red Flag 3:** No RLS blocking role updates
```sql
-- If policies show:
"Users can update own profile" FOR UPDATE USING (user_id = auth.uid())

-- And NO restriction on role field ❌

-- Need:
WITH CHECK (role = (SELECT role FROM user_profiles WHERE user_id = auth.uid()))
-- This prevents changing role via UPDATE ✅
```

---

## 🚦 Decision Tree

### **Scenario A: Existing Trigger is SECURE**

**If inspection shows:**
- ✅ Function is `SECURITY DEFINER`
- ✅ Function hardcodes `role = 'attendee'`
- ✅ RLS blocks role field changes

**Action:** Keep existing, just add missing functions
```bash
# Apply minimal migration (creates update_user_role only)
# I can create this for you
```

---

### **Scenario B: Existing Trigger is INSECURE**

**If inspection shows:**
- ❌ Function is NOT `SECURITY DEFINER`
- ❌ Function allows client to set role
- ❌ RLS doesn't block role updates

**Action:** Replace with our secure version
```bash
# Apply full migration:
supabase db push

# This will:
# 1. DROP old insecure trigger
# 2. CREATE new secure trigger  
# 3. ADD secure functions
# 4. FIX RLS policies
```

---

### **Scenario C: Can't Tell / Mixed**

**Action:** Apply our migration anyway (it's idempotent)
```bash
# Our migration uses:
# - CREATE OR REPLACE (updates existing)
# - DROP TRIGGER IF EXISTS (safe)
# - ON CONFLICT DO NOTHING (prevents errors)

# Safe to apply even if partial implementation exists
supabase db push
```

---

## 🎯 Quick Decision Guide

**Run the inspection script, then:**

1. **If you see `SECURITY DEFINER` and hardcoded `'attendee'`:**
   - ✅ Existing trigger is probably secure
   - Just add `update_user_role()` function
   - Skip full migration

2. **If you see any red flags:**
   - Apply full migration now
   - Fixes all security gaps

3. **If unsure:**
   - Apply full migration (safe, idempotent)
   - Better to be secure than sorry

---

## 🚀 Recommended Action

**I recommend: Apply the full migration**

**Why:**
- ✅ Safe (uses `CREATE OR REPLACE`, `IF EXISTS`)
- ✅ Comprehensive (adds all missing pieces)
- ✅ Tested (we verified the SQL)
- ✅ Fast (5 minutes)

**Command:**
```bash
cd /Users/rod/Desktop/yard_pass/liventix/liventix-upgrade/liventix-upgrade
supabase db push
```

**This will:**
1. Update trigger to secure version (if needed)
2. Create missing `update_user_role()` function
3. Add secure RLS policies
4. Create `is_platform_admin()` stub
5. Verify audit_log exists

---

## 📋 What to Check After

**Run this verification:**
```sql
-- From: scripts/check-profile-trigger.sql

SELECT 
  CASE 
    WHEN 
      EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user')
      AND EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_user_role')
    THEN '✅ PROFILE SECURITY FULLY IMPLEMENTED'
    ELSE '🟡 STILL PARTIAL'
  END as status;
```

**Expected after migration:** `✅ PROFILE SECURITY FULLY IMPLEMENTED`

---

## 🎯 Your Options

**Option 1: Inspect First (Conservative)**
1. Run `scripts/inspect-current-trigger.sql`
2. Evaluate security
3. Decide based on findings
4. **Time:** 15 minutes

**Option 2: Apply Migration Now (Recommended)**
1. Run `supabase db push`
2. Verify with check script
3. **Time:** 5 minutes

**Option 3: Skip Profile Security (Not Recommended)**
1. Current system probably works
2. But may have security gap
3. **Risk:** Unknown

---

## 💡 My Recommendation

**Apply the migration now** because:
- ✅ You already applied role invite migration successfully
- ✅ This migration is equally well-tested
- ✅ Uses safe SQL patterns (`CREATE OR REPLACE`)
- ✅ Takes only 5 minutes
- ✅ Eliminates any doubt about security

**Command:**
```bash
supabase db push
```

Then verify with:
```sql
-- Run: scripts/check-profile-trigger.sql
-- Should show: ✅ PROFILE SECURITY FULLY IMPLEMENTED
```

---

**What would you like to do?**
- Apply migration now? (recommended)
- Inspect existing trigger first?
- Skip for now?

Let me know! 🚀

