# YardPass Follow System Schema Clarification

## Current Database Schema

The `follows` table in YardPass has a **simplified structure**:

```sql
CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_user_id UUID NOT NULL,           -- Always a user (no org followers)
  target_type follow_target NOT NULL,       -- 'organizer', 'event', or 'user'
  target_id UUID NOT NULL,                  -- ID of what's being followed
  status TEXT DEFAULT 'accepted',           -- 'pending', 'accepted', or 'declined' (NEW)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (follower_user_id, target_type, target_id)
);
```

## Key Points

### **Follower is Always a User**
- Only **users** can follow things
- There is **NO** `follower_type` or `follower_org_id` column
- Organizations don't follow other entities (simpler model)

### **Target Can Be Three Types**
```sql
follow_target = { 'organizer', 'event', 'user' }
```

1. **User → Organizer**: User follows an organization/organizer
2. **User → Event**: User follows a specific event
3. **User → User**: User follows another user (NEW)

### **Status Column (Added by Migration)**
- **Added by**: `20250301000012_attendee_following_features.sql`
- **Default**: `'accepted'` (for backward compatibility)
- **Values**: `'pending'`, `'accepted'`, `'declined'`
- **Purpose**: User-to-user follows require approval

## Follow Workflow by Type

### **1. User → User (Requires Approval)**
```
User A clicks "Follow" on User B
  ↓
INSERT INTO follows (
  follower_user_id = A,
  target_type = 'user',
  target_id = B,
  status = 'pending'      ← Requires approval
)
  ↓
User B receives notification
  ↓
User B accepts/declines
  ↓
UPDATE follows SET status = 'accepted'/'declined'
```

### **2. User → Organizer (Auto-Approved)**
```
User clicks "Follow" on Organizer
  ↓
INSERT INTO follows (
  follower_user_id = user.id,
  target_type = 'organizer',
  target_id = org.id,
  status = 'accepted'     ← Auto-approved (or NULL, defaults to accepted)
)
  ↓
User is now following the organizer
```

### **3. User → Event (Auto-Approved)**
```
User clicks "Follow" on Event
  ↓
INSERT INTO follows (
  follower_user_id = user.id,
  target_type = 'event',
  target_id = event.id,
  status = 'accepted'     ← Auto-approved (or NULL, defaults to accepted)
)
  ↓
User is now following the event
```

## Migration Changes

### **Migration 1**: Add 'user' to enum
```sql
ALTER TYPE follow_target ADD VALUE 'user';
```

### **Migration 2**: Add status column and views
```sql
-- Add status column for approval workflow
ALTER TABLE public.follows ADD COLUMN status TEXT DEFAULT 'accepted';

-- Create views for rich profile data
CREATE VIEW follow_profiles ...
CREATE VIEW user_search ...

-- Add RLS policies for user following
CREATE POLICY "users_can_follow_other_users" ...
```

## Why This Simpler Schema?

### **Benefits**
1. **Simpler to Understand**: Only users can initiate follows
2. **Easier Queries**: No need to check follower_type
3. **Clearer Use Cases**: Users are the social actors
4. **Backward Compatible**: Existing follows continue to work

### **What It Means**
- ✅ Users can follow: Users, Organizers, Events
- ❌ Organizations cannot follow anyone (not needed)
- ✅ Status column handles user-to-user approval
- ✅ Organizer/Event follows remain instant (no status needed)

## Frontend Implications

### **useFollow Hook**
- Handles all three target types
- Sets `status = 'pending'` for user follows
- Sets `status = 'accepted'` (or omits) for org/event follows
- Works seamlessly with existing code

### **Components**
- `FollowButton`: Works for all three types
- `UserFollowList`: Shows user-to-user connections
- `UserSearchModal`: Finds users to follow
- `UserProfileSocial`: Displays social profile

## Complete Follow Graph

```
           USER
            |
            ├─→ USERS (pending → accepted/declined)
            ├─→ ORGANIZERS (accepted instantly)
            └─→ EVENTS (accepted instantly)
```

**Simple, clean, and effective!** ✨

