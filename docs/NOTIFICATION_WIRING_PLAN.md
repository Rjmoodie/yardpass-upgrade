# 🔔 Notification System Wiring Plan (v2)

> **Status**: Planning  
> **Priority**: High  
> **Estimated Effort**: 4-6 hours  
> **Last Updated**: Based on code review feedback

---

## 📋 Executive Summary

The notification system has the **frontend infrastructure** in place but is **missing database triggers**. Currently, notifications only work if the recipient has the app open when the event occurs.

This plan outlines the database triggers needed to make notifications work reliably.

---

## 🔍 Current State

### ✅ What Works
| Component | Status | Location |
|-----------|--------|----------|
| `notifications` table | ✅ Created | `public.notifications` |
| RLS policies | ✅ Configured | Users can only see their own |
| Notifications page UI | ✅ Complete | `/notifications` |
| Real-time subscriptions | ✅ Listening | `NotificationsPage.tsx` |
| Mark as read | ✅ Works | Frontend + DB |
| Delete notifications | ✅ Works | Frontend + DB |

### ❌ What's Missing
| Notification Type | Database Trigger | Status |
|-------------------|------------------|--------|
| Follow | `handle_new_follow` | ❌ Not created |
| Like | `handle_new_reaction` | ❌ Not created |
| Comment | `handle_new_comment_or_reply` | ❌ Not created |
| Reply | (unified with comment) | ❌ Not created |
| Ticket Purchase | `handle_new_ticket` | ❌ Not created |
| Message | `handle_new_message` | ❌ Not created |

---

## 🎯 Implementation Plan

### Phase 1: Schema Enhancements

#### 1.1 Create ENUMs for Type Safety

Using ENUMs prevents typos and gives compile-time checks in Postgres:

```sql
-- ============================================================================
-- ENUMS FOR TYPE SAFETY
-- ============================================================================

-- Notification severity levels
DO $$ BEGIN
  CREATE TYPE notification_severity AS ENUM ('info', 'success', 'warning', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Notification event types
DO $$ BEGIN
  CREATE TYPE notification_event_type AS ENUM (
    'user_follow',
    'post_like',
    'post_comment',
    'comment_reply',
    'ticket_purchase',
    'message_received',
    'event_update'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
```

#### 1.2 Add Deduplication Column

Prevents spam from rapid like/unlike cycles:

```sql
-- ============================================================================
-- ADD DEDUPE KEY FOR SPAM PREVENTION
-- ============================================================================

-- Add dedupe_key column if not exists
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- Unique index for deduplication (per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe 
ON public.notifications(user_id, dedupe_key) 
WHERE dedupe_key IS NOT NULL;

COMMENT ON COLUMN public.notifications.dedupe_key IS 
'Optional key for deduplication. Format: {event_type}:{resource_id}:{actor_id}';
```

---

### Phase 2: Core Helper Function

#### 2.1 Hardened `create_notification` Function

Key security improvements:
- `SET search_path` prevents hijacking via malicious objects
- `ON CONFLICT DO NOTHING` for deduplication
- Returns NULL if dedupe blocked (caller can check)

```sql
-- ============================================================================
-- CORE HELPER FUNCTION (HARDENED)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_event_type TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_data JSONB DEFAULT '{}'::jsonb,
  p_dedupe_key TEXT DEFAULT NULL  -- Optional: prevents duplicate notifications
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- Security: prevents search_path hijacking
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  -- Validate user_id
  IF p_user_id IS NULL THEN
    RAISE LOG '[Notification] Skipped: NULL user_id';
    RETURN NULL;
  END IF;

  -- Insert with optional deduplication
  INSERT INTO public.notifications (
    user_id, 
    title, 
    message, 
    type, 
    event_type, 
    action_url, 
    data,
    dedupe_key
  ) VALUES (
    p_user_id, 
    p_title, 
    p_message, 
    p_type, 
    p_event_type, 
    p_action_url, 
    p_data,
    p_dedupe_key
  )
  ON CONFLICT (user_id, dedupe_key) 
  WHERE dedupe_key IS NOT NULL
  DO NOTHING  -- Silently skip duplicates
  RETURNING id INTO v_notification_id;
  
  -- Log for debugging (remove in production after stable)
  IF v_notification_id IS NOT NULL THEN
    RAISE LOG '[Notification] Created: % for user % (type: %)', 
      v_notification_id, p_user_id, p_event_type;
  ELSE
    RAISE LOG '[Notification] Dedupe blocked: % for user %', 
      p_dedupe_key, p_user_id;
  END IF;
  
  RETURN v_notification_id;
END;
$$;

COMMENT ON FUNCTION public.create_notification IS 
'Creates a notification with optional deduplication. Returns NULL if blocked by dedupe.';
```

---

### Phase 3: Trigger Functions

#### 3.1 Follow Notifications

**When**: User A follows User B  
**Notify**: User B (the followed user)  
**Dedupe**: One notification per follower (prevents follow/unfollow spam)

```sql
-- ============================================================================
-- FOLLOW NOTIFICATION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_name TEXT;
  v_actor_avatar TEXT;
BEGIN
  -- Guard: Don't notify if following yourself
  IF NEW.follower_user_id = NEW.following_user_id THEN
    RETURN NEW;
  END IF;

  -- Get actor (follower) info
  SELECT display_name, photo_url
  INTO v_actor_name, v_actor_avatar
  FROM public.user_profiles
  WHERE user_id = NEW.follower_user_id;

  -- Guard: Skip if actor profile not found
  IF v_actor_name IS NULL THEN
    v_actor_name := 'Someone';
  END IF;

  -- Create notification with dedupe key
  PERFORM public.create_notification(
    p_user_id := NEW.following_user_id,
    p_title := 'New Follower',
    p_message := format('%s started following you', v_actor_name),
    p_type := 'info',
    p_event_type := 'user_follow',
    p_action_url := format('/user/%s', NEW.follower_user_id),
    p_data := jsonb_build_object(
      'actor_user_id', NEW.follower_user_id,
      'actor_name', v_actor_name,
      'actor_avatar', v_actor_avatar
    ),
    -- Dedupe: Only one "X followed you" notification per follower
    p_dedupe_key := format('user_follow:%s', NEW.follower_user_id)
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any (idempotent)
DROP TRIGGER IF EXISTS on_follow_created ON public.follows;

CREATE TRIGGER on_follow_created
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_follow();
```

---

#### 3.2 Like Notifications

**When**: User A likes User B's post  
**Notify**: User B (post author)  
**Dedupe**: One notification per (post, liker) pair

```sql
-- ============================================================================
-- LIKE NOTIFICATION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_post_author_id UUID;
  v_post_text TEXT;
  v_event_id UUID;
  v_actor_name TEXT;
  v_actor_avatar TEXT;
BEGIN
  -- Get post info
  SELECT author_user_id, text, event_id
  INTO v_post_author_id, v_post_text, v_event_id
  FROM public.event_posts
  WHERE id = NEW.post_id;

  -- Guard: Post not found
  IF v_post_author_id IS NULL THEN
    RAISE LOG '[Notification] Like skipped: post % not found', NEW.post_id;
    RETURN NEW;
  END IF;

  -- Guard: Don't notify if liking your own post
  IF NEW.user_id = v_post_author_id THEN
    RETURN NEW;
  END IF;

  -- Get actor (liker) info
  SELECT display_name, photo_url
  INTO v_actor_name, v_actor_avatar
  FROM public.user_profiles
  WHERE user_id = NEW.user_id;

  IF v_actor_name IS NULL THEN
    v_actor_name := 'Someone';
  END IF;

  -- Create notification with dedupe key
  PERFORM public.create_notification(
    p_user_id := v_post_author_id,
    p_title := 'New Like',
    p_message := format('%s liked your post', v_actor_name),
    p_type := 'info',
    p_event_type := 'post_like',
    p_action_url := format('/e/%s?post=%s', v_event_id, NEW.post_id),
    p_data := jsonb_build_object(
      'actor_user_id', NEW.user_id,
      'actor_name', v_actor_name,
      'actor_avatar', v_actor_avatar,
      'target_post_id', NEW.post_id,
      'target_post_preview', LEFT(COALESCE(v_post_text, ''), 50)
    ),
    -- Dedupe: Only one notification per (post, liker) pair
    p_dedupe_key := format('post_like:%s:%s', NEW.post_id, NEW.user_id)
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any (idempotent)
DROP TRIGGER IF EXISTS on_reaction_created ON public.event_reactions;

CREATE TRIGGER on_reaction_created
  AFTER INSERT ON public.event_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_reaction();
```

---

#### 3.3 Comment & Reply Notifications (Unified)

**When**: User A comments on User B's post OR replies to User B's comment  
**Notify**: Post author (for comments) OR Parent comment author (for replies)  
**No dedupe**: Each comment/reply is unique

```sql
-- ============================================================================
-- COMMENT & REPLY NOTIFICATION TRIGGER (UNIFIED)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_comment_or_reply()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_notify_user_id UUID;
  v_event_id UUID;
  v_actor_name TEXT;
  v_actor_avatar TEXT;
  v_notification_title TEXT;
  v_notification_type TEXT;
  v_is_reply BOOLEAN;
BEGIN
  v_is_reply := NEW.parent_comment_id IS NOT NULL;

  -- Get actor (commenter) info
  SELECT display_name, photo_url
  INTO v_actor_name, v_actor_avatar
  FROM public.user_profiles
  WHERE user_id = NEW.author_user_id;

  IF v_actor_name IS NULL THEN
    v_actor_name := 'Someone';
  END IF;

  -- Get event_id from post
  SELECT event_id INTO v_event_id
  FROM public.event_posts
  WHERE id = NEW.post_id;

  IF v_is_reply THEN
    -- REPLY: Notify parent comment author
    SELECT author_user_id
    INTO v_notify_user_id
    FROM public.event_comments
    WHERE id = NEW.parent_comment_id;

    v_notification_title := 'New Reply';
    v_notification_type := 'comment_reply';
  ELSE
    -- COMMENT: Notify post author
    SELECT author_user_id
    INTO v_notify_user_id
    FROM public.event_posts
    WHERE id = NEW.post_id;

    v_notification_title := 'New Comment';
    v_notification_type := 'post_comment';
  END IF;

  -- Guard: Target user not found
  IF v_notify_user_id IS NULL THEN
    RAISE LOG '[Notification] Comment skipped: target user not found for %', 
      CASE WHEN v_is_reply THEN 'reply' ELSE 'comment' END;
    RETURN NEW;
  END IF;

  -- Guard: Don't notify if commenting on your own post/reply
  IF NEW.author_user_id = v_notify_user_id THEN
    RETURN NEW;
  END IF;

  -- Create notification (no dedupe - each comment is unique)
  PERFORM public.create_notification(
    p_user_id := v_notify_user_id,
    p_title := v_notification_title,
    p_message := format('%s %s: "%s"',
      v_actor_name,
      CASE WHEN v_is_reply THEN 'replied' ELSE 'commented' END,
      LEFT(NEW.text, 50) || CASE WHEN LENGTH(NEW.text) > 50 THEN '...' ELSE '' END
    ),
    p_type := 'info',
    p_event_type := v_notification_type,
    p_action_url := format('/e/%s?post=%s', v_event_id, NEW.post_id),
    p_data := jsonb_build_object(
      'actor_user_id', NEW.author_user_id,
      'actor_name', v_actor_name,
      'actor_avatar', v_actor_avatar,
      'target_post_id', NEW.post_id,
      'target_comment_id', NEW.id,
      'target_parent_comment_id', NEW.parent_comment_id,
      'comment_preview', LEFT(NEW.text, 100)
    )
    -- No dedupe_key: each comment notification is legitimate
  );

  RETURN NEW;
END;
$$;

-- Drop existing triggers if any (idempotent)
DROP TRIGGER IF EXISTS on_comment_created ON public.event_comments;
DROP TRIGGER IF EXISTS on_reply_created ON public.event_comments;

-- Single trigger handles both comments and replies
CREATE TRIGGER on_comment_created
  AFTER INSERT ON public.event_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_comment_or_reply();
```

---

#### 3.4 Ticket Purchase Notifications

**When**: User purchases a ticket  
**Notify**: The buyer (purchase confirmation)  
**No dedupe**: Each ticket is unique

```sql
-- ============================================================================
-- TICKET PURCHASE NOTIFICATION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_title TEXT;
  v_tier_name TEXT;
BEGIN
  -- Guard: No owner
  IF NEW.owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get event info
  SELECT title INTO v_event_title
  FROM public.events
  WHERE id = NEW.event_id;

  IF v_event_title IS NULL THEN
    v_event_title := 'the event';
  END IF;

  -- Get tier info
  SELECT name INTO v_tier_name
  FROM public.ticket_tiers
  WHERE id = NEW.ticket_tier_id;

  IF v_tier_name IS NULL THEN
    v_tier_name := 'ticket';
  END IF;

  -- Create notification
  PERFORM public.create_notification(
    p_user_id := NEW.owner_user_id,
    p_title := 'Ticket Confirmed! 🎫',
    p_message := format('Your %s ticket for %s is ready', v_tier_name, v_event_title),
    p_type := 'success',
    p_event_type := 'ticket_purchase',
    p_action_url := '/tickets',
    p_data := jsonb_build_object(
      'target_ticket_id', NEW.id,
      'target_event_id', NEW.event_id,
      'target_event_title', v_event_title,
      'target_tier_name', v_tier_name
    )
    -- No dedupe: each ticket purchase is unique
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any (idempotent)
DROP TRIGGER IF EXISTS on_ticket_created ON public.tickets;

CREATE TRIGGER on_ticket_created
  AFTER INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_ticket();
```

---

#### 3.5 Message Notifications

**When**: User A sends message to User B  
**Notify**: User B (recipient)  
**No dedupe**: Each message is unique

```sql
-- ============================================================================
-- MESSAGE NOTIFICATION TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_name TEXT;
  v_actor_avatar TEXT;
  v_recipient_id UUID;
BEGIN
  -- Get recipient (the other participant in the conversation)
  SELECT 
    CASE 
      WHEN participant_1 = NEW.sender_id THEN participant_2
      ELSE participant_1
    END
  INTO v_recipient_id
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  -- Guard: Conversation not found or recipient is NULL
  IF v_recipient_id IS NULL THEN
    RAISE LOG '[Notification] Message skipped: conversation % not found or no recipient', 
      NEW.conversation_id;
    RETURN NEW;
  END IF;

  -- Guard: Don't notify if somehow sending to yourself
  IF NEW.sender_id = v_recipient_id THEN
    RETURN NEW;
  END IF;

  -- Get actor (sender) info
  SELECT display_name, photo_url
  INTO v_actor_name, v_actor_avatar
  FROM public.user_profiles
  WHERE user_id = NEW.sender_id;

  IF v_actor_name IS NULL THEN
    v_actor_name := 'Someone';
  END IF;

  -- Create notification
  PERFORM public.create_notification(
    p_user_id := v_recipient_id,
    p_title := 'New Message',
    p_message := format('%s: %s',
      v_actor_name,
      LEFT(NEW.content, 50) || CASE WHEN LENGTH(NEW.content) > 50 THEN '...' ELSE '' END
    ),
    p_type := 'info',
    p_event_type := 'message_received',
    p_action_url := format('/messages/%s', NEW.conversation_id),
    p_data := jsonb_build_object(
      'actor_user_id', NEW.sender_id,
      'actor_name', v_actor_name,
      'actor_avatar', v_actor_avatar,
      'target_conversation_id', NEW.conversation_id,
      'message_preview', LEFT(NEW.content, 100)
    )
    -- No dedupe: each message notification is legitimate
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any (idempotent)
DROP TRIGGER IF EXISTS on_message_created ON public.messages;

CREATE TRIGGER on_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_message();
```

---

## 📁 Migration File

All code will be in a single migration file:

```
supabase/migrations/YYYYMMDD000000_notification_triggers.sql
```

**Order of execution**:
1. Create ENUMs (if not exist)
2. Add `dedupe_key` column and unique index
3. Create `create_notification()` helper function
4. Create trigger functions (5 total)
5. Create triggers (5 total)
6. Grant permissions

---

## 🔐 Security Considerations

### SECURITY DEFINER Hardening
All functions include:
```sql
SECURITY DEFINER
SET search_path = public, pg_temp
```

This:
- Allows triggers to insert notifications (bypasses RLS)
- Prevents search_path hijacking attacks
- Keeps functions scoped to `public` schema

### RLS Remains Enforced
Users can still only:
- **SELECT** their own notifications
- **UPDATE** their own notifications (mark as read)
- **DELETE** their own notifications

---

## 📊 Data Payload Convention

All notifications use consistent payload naming:

| Key | Description | Example |
|-----|-------------|---------|
| `actor_user_id` | Who triggered the action | Follower, liker, commenter |
| `actor_name` | Display name (snapshot) | "John Doe" |
| `actor_avatar` | Avatar URL (snapshot) | "https://..." |
| `target_post_id` | Related post ID | For likes, comments |
| `target_comment_id` | Related comment ID | For replies |
| `target_event_id` | Related event ID | For tickets |
| `target_conversation_id` | Related conversation ID | For messages |
| `*_preview` | Truncated content | First 50-100 chars |

**Tradeoff**: Snapshots may become stale if users change names/avatars, but avoid expensive joins on read.

---

## 🧪 Testing Plan

### Manual Testing
| Test | Expected Result |
|------|-----------------|
| Follow a user | They see notification within 1 second |
| Like someone's post | Post author sees notification |
| Comment on a post | Post author sees notification |
| Reply to a comment | Comment author sees notification |
| Purchase a ticket | You see confirmation notification |
| Send a message | Recipient sees notification |
| Like your own post | No notification |
| Comment on your own post | No notification |
| Follow/unfollow/follow same user | Only ONE notification (dedupe) |
| Like/unlike/like same post | Only ONE notification (dedupe) |

### RLS Sanity Check
```sql
-- As user A, try to see user B's notifications
SET request.jwt.claim.sub = 'user-a-id';
SELECT * FROM notifications WHERE user_id = 'user-b-id';
-- Expected: 0 rows (blocked by RLS)
```

### Load Test
- 100 likes on the same post from different users
- Verify: DB latency acceptable, notifications page stays snappy

### Edge Cases
- [ ] Deleted user liking a post → graceful skip
- [ ] Missing profile data → defaults to "Someone"
- [ ] Conversation soft-deleted → message notification skipped
- [ ] Rapid follow/unfollow → only one notification

---

## 🚀 Deployment Steps

1. **Create migration file** with all SQL
2. **Test locally**: `supabase db reset`
3. **Verify triggers created**: Check `pg_trigger` table
4. **Test each notification type** manually
5. **Deploy to staging**: `supabase db push`
6. **Verify in staging dashboard**
7. **Monitor logs** for any RAISE LOG messages
8. **Deploy to production**
9. **Monitor for 24 hours**, check for spam/errors

---

## 🔮 Future Enhancements

### Short-term
- [ ] **Notification preferences** - Let users mute specific types
- [ ] **Aggregation** - "5 people liked your post" instead of 5 notifications
- [ ] **Read receipts** - Track when notifications were seen

### Medium-term  
- [ ] **Push notifications** - FCM/APNs via Edge Function
- [ ] **Email digests** - Daily/weekly summary
- [ ] **Event update notifications** - Via job queue (not trigger)

### Long-term
- [ ] **Notification center** - Slide-out panel like Twitter
- [ ] **Smart batching** - Group similar notifications
- [ ] **ML-based priority** - Show important ones first

---

## ✅ Review Checklist

- [ ] ENUMs created for type safety
- [ ] `dedupe_key` column added with unique index
- [ ] All SECURITY DEFINER functions have `SET search_path`
- [ ] All triggers have defensive null checks
- [ ] Payload uses consistent `actor_*` / `target_*` naming
- [ ] Migration is idempotent (DROP TRIGGER IF EXISTS)
- [ ] Logging added for debugging (can remove later)
- [ ] RLS policies unchanged (users see only their own)
- [ ] No triggers for event updates (will use job queue)

---

**Author**: AI Assistant  
**Status**: Ready for Implementation  
**Approved by**: ________________  
**Date**: ________________
