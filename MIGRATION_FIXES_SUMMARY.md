# Migration Fixes Summary

## Issues Encountered and Resolved

### **Issue 1: Enum Transaction Safety**
**Error**: `unsafe use of new value "user" of enum type follow_target`

**Root Cause**: PostgreSQL doesn't allow adding a new enum value and using it in the same transaction.

**Solution**: Split into two migrations:
1. `20250301000011_add_user_to_follow_target.sql` - Add enum value
2. `20250301000012_attendee_following_features.sql` - Use the enum value

---

### **Issue 2: Schema Mismatch - follower_type**
**Error**: `column f.follower_type does not exist`

**Root Cause**: The `follows` table has a simpler schema than assumed. Only users can follow (no `follower_type` or `follower_org_id` columns).

**Solution**: Updated views to work with the actual schema:
```sql
-- Actual schema
CREATE TABLE public.follows (
  follower_user_id UUID,  -- Always a user
  target_type follow_target,  -- Can be 'user', 'organizer', or 'event'
  target_id UUID,
  status TEXT  -- Added by migration
);
```

---

### **Issue 3: Missing User Profile Columns**
**Error**: `column up.bio does not exist`

**Root Cause**: The `user_profiles` table doesn't have social profile columns (`bio`, `photo_url`, `location`).

**Solution**: Migration now adds these columns:
```sql
ALTER TABLE public.user_profiles ADD COLUMN bio TEXT;
ALTER TABLE public.user_profiles ADD COLUMN photo_url TEXT;
ALTER TABLE public.user_profiles ADD COLUMN location TEXT;
```

---

## Final Migration Structure

### **Migration 1**: `20250301000011_add_user_to_follow_target.sql`
```sql
-- Simple: Just add the enum value
ALTER TYPE follow_target ADD VALUE 'user';
```

### **Migration 2**: `20250301000012_attendee_following_features.sql`
```sql
-- Step 1: Add columns to user_profiles
ALTER TABLE user_profiles ADD bio, photo_url, location;

-- Step 2: Add status column to follows
ALTER TABLE follows ADD status DEFAULT 'accepted';

-- Step 3: Create views
CREATE VIEW follow_profiles ...
CREATE VIEW user_search ...

-- Step 4: Add RLS policies
CREATE POLICY "users_can_follow_other_users" ...

-- Step 5: Create helper functions
CREATE FUNCTION get_user_connections() ...
CREATE FUNCTION get_mutual_connections() ...

-- Step 6: Add indexes
CREATE INDEX idx_follows_user_target ...

-- Step 7: Add notification triggers
CREATE TRIGGER trg_notify_user_follow ...
```

---

## Actual Follow System Schema

### **Simplified Structure**
```
FOLLOWS TABLE
├── follower_user_id (UUID) ────→ Always a user
├── target_type (ENUM) ─────────→ 'user' | 'organizer' | 'event'
├── target_id (UUID) ───────────→ ID of target
└── status (TEXT) ──────────────→ 'pending' | 'accepted' | 'declined'
```

### **What This Means**
- ✅ **Users** can follow: Users, Organizers, Events
- ❌ **Organizations** cannot follow (not in schema)
- ✅ User-to-user follows require approval (status: pending)
- ✅ Organizer/Event follows are instant (status: accepted)

---

## Updated User Profiles Schema

### **Before Migration**
```sql
user_profiles (
  user_id UUID,
  display_name TEXT,
  phone TEXT,
  role TEXT,
  verification_status TEXT
)
```

### **After Migration**
```sql
user_profiles (
  user_id UUID,
  display_name TEXT,
  phone TEXT,
  role TEXT,
  verification_status TEXT,
  bio TEXT,           -- NEW: User biography
  photo_url TEXT,     -- NEW: Profile photo URL
  location TEXT       -- NEW: User location
)
```

---

## How It Works Now

### **1. User Following Another User**
```sql
INSERT INTO follows (
  follower_user_id = 'user-a-id',
  target_type = 'user',
  target_id = 'user-b-id',
  status = 'pending'  -- Requires approval
);

-- User B gets notified
-- User B accepts: UPDATE follows SET status = 'accepted'
```

### **2. User Following an Organizer**
```sql
INSERT INTO follows (
  follower_user_id = 'user-id',
  target_type = 'organizer',
  target_id = 'org-id',
  status = 'accepted'  -- Instant (or NULL, defaults to accepted)
);
```

### **3. User Following an Event**
```sql
INSERT INTO follows (
  follower_user_id = 'user-id',
  target_type = 'event',
  target_id = 'event-id',
  status = 'accepted'  -- Instant (or NULL, defaults to accepted)
);
```

---

## Views Created

### **1. follow_profiles**
Provides rich profile data for follow lists:
- Target name and photo (user/organizer/event)
- Follower name and photo (user)
- Follow status
- Created date

### **2. user_search**
Enables user discovery:
- User profile data (name, photo, bio, location)
- Follower/following counts
- Current user's follow status for each user

---

## Functions Created

### **1. get_user_connections(user_id)**
Returns all connections for a user:
- Who they're following
- Who's following them
- Connection metadata

### **2. get_mutual_connections(user1_id, user2_id)**
Returns mutual connections between two users:
- Shared connections
- Connection profiles

---

## All Issues Resolved! ✅

- ✅ Fixed enum transaction safety issue
- ✅ Updated for actual follows table schema
- ✅ Added missing user_profiles columns
- ✅ Created working views and functions
- ✅ Added proper RLS policies
- ✅ Added notification triggers
- ✅ Added performance indexes

**The migrations are now ready to run!** 🚀

---

## How to Deploy

```bash
# Run in order (IMPORTANT!)
supabase migration apply 20250301000011_add_user_to_follow_target
supabase migration apply 20250301000012_attendee_following_features
```

The migrations will:
1. Add 'user' to follow_target enum ✅
2. Add social columns to user_profiles ✅
3. Add status column to follows ✅
4. Create views for follow data ✅
5. Add RLS policies ✅
6. Create helper functions ✅
7. Add indexes ✅
8. Add notification triggers ✅

**Everything is now compatible with your existing schema!** 🎉

