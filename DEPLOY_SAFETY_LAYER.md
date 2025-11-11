# 🛡️ Deploy Safety Layer Migration

**Migration:** `20251111000000_add_follow_safety_layer.sql`  
**Status:** Fixed and ready to deploy

---

## ✅ What Was Fixed

### **Problem:**
- Migration was trying to modify `public.follows` (VIEW)
- Should target `users.follows` (TABLE)

### **Solution:**
- Changed all references from `public.follows` → `users.follows`
- Added drop statements for ALL existing policies:
  - `follows_delete_policy`
  - `follows_insert_policy`
  - `follows_select_policy`
  - `follows_update_policy`
  - `own_follows_all`
  - `public_follows_select`

---

## 🚀 Deploy Now

### **Step 1: Apply Migration**

```bash
cd /Users/rod/Desktop/yard_pass/yardpass/yardpass-upgrade/yardpass-upgrade

supabase db push
```

**Expected output:**
```
✓ Applying migration 20251111000000_add_follow_safety_layer.sql
✅ Follow safety layer migration complete:
   - Blocks table created with RLS
   - Private account support added
   - Follows RLS updated to enforce blocking
   ...
```

---

### **Step 2: Verify Migration**

Run the diagnostic to confirm everything worked:

```bash
# Copy this SQL and run in Supabase SQL Editor:
```

```sql
-- Quick verification
SELECT 
  'blocks table' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'blocks')
  THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT 
  'is_private column',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'users' AND table_name = 'user_profiles' AND column_name = 'is_private')
  THEN '✅ EXISTS' ELSE '❌ MISSING' END
UNION ALL
SELECT 
  'RLS policies',
  CASE WHEN COUNT(*) >= 4 THEN '✅ ' || COUNT(*)::text || ' policies' ELSE '❌ ONLY ' || COUNT(*)::text END
FROM pg_policies WHERE schemaname = 'users' AND tablename = 'follows'
UNION ALL
SELECT 
  'Helper functions',
  CASE WHEN COUNT(*) >= 3 THEN '✅ ' || COUNT(*)::text || ' functions' ELSE '❌ ONLY ' || COUNT(*)::text END
FROM information_schema.routines
WHERE routine_name IN ('is_user_blocked', 'users_have_block', 'is_user_private');
```

**Expected result:**
```
blocks table       | ✅ EXISTS
is_private column  | ✅ EXISTS
RLS policies       | ✅ 4 policies
Helper functions   | ✅ 3 functions
```

---

### **Step 3: Test Blocking**

```sql
-- 1. Block a user (replace with real user IDs):
INSERT INTO public.blocks (blocker_user_id, blocked_user_id)
VALUES (
  (SELECT id FROM auth.users LIMIT 1 OFFSET 0), -- Your user
  (SELECT id FROM auth.users LIMIT 1 OFFSET 1)  -- Target user
);

-- 2. Verify mutual follows were removed:
SELECT COUNT(*) as should_be_zero
FROM users.follows
WHERE (
  follower_user_id = (SELECT id FROM auth.users LIMIT 1 OFFSET 0)
  AND target_id = (SELECT id FROM auth.users LIMIT 1 OFFSET 1)
) OR (
  follower_user_id = (SELECT id FROM auth.users LIMIT 1 OFFSET 1)
  AND target_id = (SELECT id FROM auth.users LIMIT 1 OFFSET 0)
);

-- 3. Try to follow (should fail with RLS error):
INSERT INTO users.follows (follower_user_id, target_type, target_id)
VALUES (
  (SELECT id FROM auth.users LIMIT 1 OFFSET 0),
  'user',
  (SELECT id FROM auth.users LIMIT 1 OFFSET 1)
);
-- Should return: ERROR: new row violates row-level security policy
```

---

### **Step 4: Test Private Accounts**

```sql
-- 1. Make a user private:
UPDATE users.user_profiles
SET is_private = true
WHERE user_id = (SELECT id FROM auth.users LIMIT 1 OFFSET 1);

-- 2. Try to follow them (as another user):
-- This should succeed but with status = 'pending'
INSERT INTO users.follows (follower_user_id, target_type, target_id)
VALUES (
  (SELECT id FROM auth.users LIMIT 1 OFFSET 0),
  'user',
  (SELECT id FROM auth.users LIMIT 1 OFFSET 1)
);

-- 3. Check status:
SELECT status
FROM users.follows
WHERE follower_user_id = (SELECT id FROM auth.users LIMIT 1 OFFSET 0)
  AND target_id = (SELECT id FROM auth.users LIMIT 1 OFFSET 1);
-- Should return: 'pending'
```

---

## 🎯 What This Migration Does

### **1. Blocks Table**
```sql
CREATE TABLE public.blocks (
  blocker_user_id UUID,
  blocked_user_id UUID,
  reason TEXT,
  UNIQUE (blocker_user_id, blocked_user_id)
);
```
- Prevents duplicate blocks
- Prevents self-blocking
- RLS: Users can only see their own blocks

### **2. Private Accounts**
```sql
ALTER TABLE users.user_profiles 
ADD COLUMN is_private BOOLEAN DEFAULT false;
```
- If `true`, new follows start as `pending`
- User must explicitly accept/decline

### **3. Block Enforcement**
- Updated RLS policies check for blocks before allowing follows
- Trigger removes existing follows when block is created
- `users_have_block()` function checks both directions

### **4. Updated user_search View**
- Excludes blocked users from search results
- Shows `is_blocked` status
- Shows `is_private` status

---

## 🔧 Troubleshooting

### **Error: "function auth.uid() does not exist"**
**Solution:** Make sure you're connected to the right database. The `auth` schema should exist.

### **Error: "relation users.follows does not exist"**
**Solution:** This means your database structure is different. Check:
```sql
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename = 'follows';
```

### **Error: "policy already exists"**
**Solution:** Run this to drop all policies first:
```sql
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'users' AND tablename = 'follows'
  LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON users.follows';
  END LOOP;
END $$;
```

Then re-run the migration.

---

## ✅ Success Checklist

- [ ] Migration applied without errors
- [ ] Verification query shows all ✅
- [ ] Block test works (follows removed)
- [ ] Private account test works (status = pending)
- [ ] Frontend deployed with new hooks
- [ ] `FollowRealtimeProvider` added to App

---

## 🎉 Next Steps

Once this migration is successful:

1. ✅ Deploy frontend changes (Phase 1 & 2)
2. ✅ Test in production
3. ⏳ Apply messaging migration (Phase 3) later

---

**Ready to deploy?** Run `supabase db push` now! 🚀


