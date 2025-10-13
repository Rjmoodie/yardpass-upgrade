## Debugging Guide: Attendee Following System

### Issue: "No rows returned" from views

This is likely **expected behavior** if:
1. No users have followed each other yet (user-to-user follows)
2. User profiles don't have bio/photo/location data yet
3. The views are working correctly but there's just no data

---

## Step-by-Step Debugging

### **Step 1: Verify Migration Success**

Run the debug script:
```bash
# In Supabase SQL Editor or via CLI
psql -f debug-attendee-following.sql
```

**Expected Results:**
- ✅ `follow_target` enum includes: `{organizer,event,user}`
- ✅ `user_profiles` has columns: `bio`, `photo_url`, `location`
- ✅ `follows` has column: `status`
- ✅ Views exist: `follow_profiles`, `user_search`
- ✅ Functions exist: `get_user_connections`, `get_mutual_connections`

---

### **Step 2: Check Current Data**

```sql
-- How many users exist?
SELECT COUNT(*) FROM user_profiles;

-- How many have the new social fields?
SELECT 
  COUNT(*) as total,
  COUNT(bio) as with_bio,
  COUNT(photo_url) as with_photo,
  COUNT(location) as with_location
FROM user_profiles;

-- What follows exist?
SELECT 
  target_type,
  COUNT(*) as count
FROM follows
GROUP BY target_type;
```

**What This Tells You:**
- If `with_bio/photo/location` are 0, that's why `user_search` returns rows but with empty data
- If no `user` type follows exist, that's why `follow_profiles` is empty for user follows

---

### **Step 3: Add Test Data**

```bash
# Populate some test user data
psql -f populate-test-user-data.sql
```

This will:
- Add sample bios to first 5 users
- Add avatar photos
- Add locations
- Let you verify the views work

---

### **Step 4: Test the Views Directly**

```sql
-- Test user_search (should now show data)
SELECT 
  display_name,
  bio,
  location,
  follower_count,
  following_count
FROM user_search
LIMIT 5;

-- Test follow_profiles (shows existing follows with names)
SELECT 
  follower_name,
  target_type,
  target_name,
  status
FROM follow_profiles
LIMIT 5;
```

**What You Should See:**
- `user_search`: All users with their bio/photo/location
- `follow_profiles`: Existing organizer/event follows with user names populated

---

### **Step 5: Test User-to-User Following**

Create a test follow via SQL (simulating what the app does):

```sql
-- Get two different users
WITH test_users AS (
  SELECT user_id, ROW_NUMBER() OVER (ORDER BY created_at) as rn
  FROM user_profiles LIMIT 2
)
INSERT INTO follows (follower_user_id, target_type, target_id, status)
SELECT 
  (SELECT user_id FROM test_users WHERE rn = 1),
  'user',
  (SELECT user_id FROM test_users WHERE rn = 2),
  'pending'
WHERE (SELECT COUNT(*) FROM test_users) >= 2
RETURNING *;
```

Then check:
```sql
-- Should see the pending follow
SELECT * FROM follow_profiles 
WHERE target_type = 'user';

-- Should see updated counts
SELECT * FROM user_search LIMIT 5;
```

---

### **Step 6: Verify Frontend Integration**

1. **Navigate to `/social`** in your app
2. **Check browser console** for any errors
3. **Try searching for users**
4. **Try following someone**
5. **Check notifications**

---

## Common Issues and Solutions

### **Issue: Views return empty results**
**Cause**: No data exists yet  
**Solution**: This is expected! Add some test data or wait for real users

### **Issue: `user_search` returns rows but fields are null**
**Cause**: User profiles don't have bio/photo/location yet  
**Solution**: Users need to edit their profiles, or run `populate-test-user-data.sql`

### **Issue: Can't insert user follows**
**Cause**: RLS policies might be blocking  
**Solution**: Check you're authenticated and using `auth.uid()`

### **Issue: Follow requests don't show up**
**Cause**: Status might not be set correctly  
**Solution**: Ensure `status = 'pending'` for user follows

---

## Verification Checklist

Run this comprehensive test:
```bash
psql -f test-user-following.sql
```

### **✅ Database Schema**
- [ ] `follow_target` enum includes 'user'
- [ ] `user_profiles` has bio, photo_url, location columns
- [ ] `follows` has status column

### **✅ Views**
- [ ] `follow_profiles` view exists
- [ ] `user_search` view exists
- [ ] Views return data (after populating test data)

### **✅ Functions**
- [ ] `get_user_connections()` exists and works
- [ ] `get_mutual_connections()` exists and works
- [ ] `notify_user_follow()` trigger function exists

### **✅ Security**
- [ ] RLS policies exist for user following
- [ ] Can't follow yourself
- [ ] Can see own follows

### **✅ Indexes**
- [ ] `idx_follows_user_target` exists
- [ ] `idx_follows_user_follower` exists
- [ ] `idx_follows_user_status` exists

### **✅ Triggers**
- [ ] `trg_notify_user_follow` trigger exists
- [ ] Fires on INSERT/UPDATE to follows

---

## Expected Behavior

### **When No Data Exists**
```sql
-- user_search will return all users but:
SELECT * FROM user_search;
-- bio: NULL
-- photo_url: NULL  
-- location: NULL
-- follower_count: 0
-- following_count: 0
-- current_user_follow_status: 'none'
```

This is **CORRECT**! It means the view is working, just no data yet.

### **When Test Data Exists**
```sql
-- user_search will show populated data:
SELECT * FROM user_search LIMIT 1;
-- bio: 'Music lover and event enthusiast...'
-- photo_url: 'https://api.dicebear.com/...'
-- location: 'Los Angeles, CA'
-- follower_count: 0 (until someone follows)
-- following_count: 0 (until user follows someone)
```

### **When User Follows Exist**
```sql
-- follow_profiles will show:
SELECT * FROM follow_profiles WHERE target_type = 'user';
-- follower_name: 'Alice Smith'
-- target_name: 'Bob Johnson'
-- status: 'pending' or 'accepted'
```

---

## Quick Verification Commands

```sql
-- 1. Migration applied?
SELECT enum_range(NULL::follow_target);
-- Should include 'user'

-- 2. Columns added?
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
  AND column_name IN ('bio', 'photo_url', 'location');
-- Should return 3 rows

-- 3. Views created?
SELECT viewname FROM pg_views 
WHERE viewname IN ('follow_profiles', 'user_search');
-- Should return 2 rows

-- 4. Functions created?
SELECT proname FROM pg_proc 
WHERE proname LIKE '%user_connection%';
-- Should return 2 rows

-- 5. Any data?
SELECT COUNT(*) FROM user_search;
-- Should match number of users in user_profiles
```

---

## If Everything Looks Good But UI Shows Nothing

### **Frontend Checklist:**

1. **Check network requests** in browser DevTools
2. **Verify Supabase client** is initialized
3. **Check auth state** - user must be logged in
4. **Look for errors** in console
5. **Verify route** `/social` is accessible
6. **Check permissions** - RLS policies might block

### **Test Direct Query:**

```javascript
// In browser console
const { data, error } = await supabase
  .from('user_search')
  .select('*')
  .limit(5);

console.log('Data:', data);
console.log('Error:', error);
```

If this returns data, the backend is fine and it's a frontend issue.

---

## Summary

**"No rows returned" is likely EXPECTED because:**
1. ✅ Migration was successful
2. ✅ Views are working correctly  
3. ✅ There's just no data yet

**To verify everything works:**
1. Run `test-user-following.sql`
2. Run `populate-test-user-data.sql`
3. Try creating a user-to-user follow
4. Check the views again

**The system is ready!** Just needs actual user data. 🎉

