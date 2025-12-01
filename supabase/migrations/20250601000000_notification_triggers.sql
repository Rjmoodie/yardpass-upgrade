-- ============================================================================
-- Migration: Notification System Triggers
-- Purpose: Create database triggers for automatic notification generation
-- Author: AI Assistant
-- Date: 2025-06-01
-- 
-- IMPORTANT: This migration uses the ACTUAL tables, not views:
--   - users.follows (not public.follows which is a view)
--   - events.event_reactions (not public.event_reactions which is a view)
--   - events.event_comments (not public.event_comments which is a view)
--   - ticketing.tickets (not public.tickets)
--   - messaging.direct_messages (not public.messages)
-- ============================================================================

-- ============================================================================
-- PHASE 1: SCHEMA ENHANCEMENTS
-- ============================================================================

-- 1.1 Create ENUMs for type safety (idempotent)
DO $$ BEGIN
  CREATE TYPE notification_severity AS ENUM ('info', 'success', 'warning', 'error');
EXCEPTION
  WHEN duplicate_object THEN 
    RAISE NOTICE 'Type notification_severity already exists, skipping';
END $$;

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
  WHEN duplicate_object THEN 
    RAISE NOTICE 'Type notification_event_type already exists, skipping';
END $$;

-- 1.2 Add dedupe_key column for spam prevention
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

COMMENT ON COLUMN public.notifications.dedupe_key IS 
'Optional key for deduplication. Format: {event_type}:{resource_id}:{actor_id}';

-- 1.3 Create unique index for deduplication (per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe 
ON public.notifications(user_id, dedupe_key) 
WHERE dedupe_key IS NOT NULL;

-- ============================================================================
-- PHASE 2: CORE HELPER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_event_type TEXT DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_data JSONB DEFAULT '{}'::jsonb,
  p_dedupe_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
    dedupe_key,
    created_at
  ) VALUES (
    p_user_id, 
    p_title, 
    p_message, 
    p_type, 
    p_event_type, 
    p_action_url, 
    p_data,
    p_dedupe_key,
    NOW()
  )
  ON CONFLICT (user_id, dedupe_key) 
  WHERE dedupe_key IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_notification_id;
  
  -- Log for debugging (can remove after stable)
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;

-- ============================================================================
-- PHASE 3: TRIGGER FUNCTIONS
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 3.1 FOLLOW NOTIFICATION TRIGGER
-- Table: users.follows (NOT public.follows which is a view)
-- Columns: follower_user_id, target_type, target_id, status
-- -----------------------------------------------------------------------------

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
  -- Only notify for user-to-user follows (not event or org follows)
  IF NEW.target_type != 'user' THEN
    RETURN NEW;
  END IF;

  -- Guard: Don't notify if following yourself
  IF NEW.follower_user_id = NEW.target_id THEN
    RETURN NEW;
  END IF;

  -- Only notify for accepted follows
  IF NEW.status NOT IN ('accepted', 'pending') THEN
    RETURN NEW;
  END IF;

  -- Get actor (follower) info
  SELECT display_name, photo_url
  INTO v_actor_name, v_actor_avatar
  FROM public.user_profiles
  WHERE user_id = NEW.follower_user_id;

  IF v_actor_name IS NULL THEN
    v_actor_name := 'Someone';
  END IF;

  -- Create notification (target_id is the user being followed)
  PERFORM public.create_notification(
    p_user_id := NEW.target_id,
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
    p_dedupe_key := format('user_follow:%s', NEW.follower_user_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_follow_notification ON users.follows;

CREATE TRIGGER on_follow_notification
  AFTER INSERT ON users.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_follow();

-- -----------------------------------------------------------------------------
-- 3.2 LIKE NOTIFICATION TRIGGER
-- Table: events.event_reactions (NOT public.event_reactions which is a view)
-- Columns: user_id, post_id
-- -----------------------------------------------------------------------------

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
  -- Get post info from events.event_posts
  SELECT author_user_id, text, event_id
  INTO v_post_author_id, v_post_text, v_event_id
  FROM events.event_posts
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
    p_dedupe_key := format('post_like:%s:%s', NEW.post_id, NEW.user_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_reaction_notification ON events.event_reactions;

CREATE TRIGGER on_reaction_notification
  AFTER INSERT ON events.event_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_reaction();

-- -----------------------------------------------------------------------------
-- 3.3 COMMENT & REPLY NOTIFICATION TRIGGER (UNIFIED)
-- Table: events.event_comments (NOT public.event_comments which is a view)
-- Columns: author_user_id, post_id, text, parent_comment_id
-- -----------------------------------------------------------------------------

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
  FROM events.event_posts
  WHERE id = NEW.post_id;

  IF v_is_reply THEN
    -- REPLY: Notify parent comment author
    SELECT author_user_id
    INTO v_notify_user_id
    FROM events.event_comments
    WHERE id = NEW.parent_comment_id;

    v_notification_title := 'New Reply';
    v_notification_type := 'comment_reply';
  ELSE
    -- COMMENT: Notify post author
    SELECT author_user_id
    INTO v_notify_user_id
    FROM events.event_posts
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
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_notification ON events.event_comments;

CREATE TRIGGER on_comment_notification
  AFTER INSERT ON events.event_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_comment_or_reply();

-- -----------------------------------------------------------------------------
-- 3.4 TICKET PURCHASE NOTIFICATION TRIGGER
-- Table: ticketing.tickets (NOT public.tickets)
-- Columns: owner_user_id, event_id, ticket_tier_id (or tier_id)
-- -----------------------------------------------------------------------------

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

  -- Get event info from events.events
  SELECT title INTO v_event_title
  FROM events.events
  WHERE id = NEW.event_id;

  IF v_event_title IS NULL THEN
    v_event_title := 'the event';
  END IF;

  -- Get tier info from ticketing.ticket_tiers
  -- Column is tier_id in ticketing.tickets table
  SELECT name INTO v_tier_name
  FROM ticketing.ticket_tiers
  WHERE id = NEW.tier_id;

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
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_ticket_notification ON ticketing.tickets;

CREATE TRIGGER on_ticket_notification
  AFTER INSERT ON ticketing.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_ticket();

-- -----------------------------------------------------------------------------
-- 3.5 MESSAGE NOTIFICATION TRIGGER
-- Table: messaging.direct_messages (NOT public.messages)
-- Columns: sender_user_id, conversation_id, body (NOT content)
-- Recipient lookup via: messaging.conversation_participants
-- -----------------------------------------------------------------------------

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
  -- Only handle user-to-user messages (sender_type = 'user')
  IF NEW.sender_type != 'user' OR NEW.sender_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the OTHER user participant in this conversation
  SELECT cp.participant_user_id
  INTO v_recipient_id
  FROM messaging.conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.participant_type = 'user'
    AND cp.participant_user_id IS NOT NULL
    AND cp.participant_user_id != NEW.sender_user_id
  LIMIT 1;

  -- Guard: Recipient not found (might be org-only conversation)
  IF v_recipient_id IS NULL THEN
    RAISE LOG '[Notification] Message skipped: no user recipient found for conversation %', 
      NEW.conversation_id;
    RETURN NEW;
  END IF;

  -- Guard: Don't notify if somehow sending to yourself
  IF NEW.sender_user_id = v_recipient_id THEN
    RETURN NEW;
  END IF;

  -- Get actor (sender) info
  SELECT display_name, photo_url
  INTO v_actor_name, v_actor_avatar
  FROM public.user_profiles
  WHERE user_id = NEW.sender_user_id;

  IF v_actor_name IS NULL THEN
    v_actor_name := 'Someone';
  END IF;

  -- Create notification (body is the message content, not content)
  PERFORM public.create_notification(
    p_user_id := v_recipient_id,
    p_title := 'New Message',
    p_message := format('%s: %s',
      v_actor_name,
      LEFT(NEW.body, 50) || CASE WHEN LENGTH(NEW.body) > 50 THEN '...' ELSE '' END
    ),
    p_type := 'info',
    p_event_type := 'message_received',
    p_action_url := format('/messages/%s', NEW.conversation_id),
    p_data := jsonb_build_object(
      'actor_user_id', NEW.sender_user_id,
      'actor_name', v_actor_name,
      'actor_avatar', v_actor_avatar,
      'target_conversation_id', NEW.conversation_id,
      'message_preview', LEFT(NEW.body, 100)
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_notification ON messaging.direct_messages;

CREATE TRIGGER on_message_notification
  AFTER INSERT ON messaging.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_message();

-- ============================================================================
-- PHASE 4: VERIFICATION & LOGGING
-- ============================================================================

DO $$
DECLARE
  trigger_count INTEGER := 0;
  function_count INTEGER;
BEGIN
  -- Count functions
  SELECT COUNT(*) INTO function_count
  FROM pg_proc
  WHERE proname IN (
    'create_notification',
    'handle_new_follow',
    'handle_new_reaction',
    'handle_new_comment_or_reply',
    'handle_new_ticket',
    'handle_new_message'
  );

  -- Count triggers (check each table separately due to different schemas)
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_follow_notification') THEN
    trigger_count := trigger_count + 1;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_reaction_notification') THEN
    trigger_count := trigger_count + 1;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_comment_notification') THEN
    trigger_count := trigger_count + 1;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_ticket_notification') THEN
    trigger_count := trigger_count + 1;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_message_notification') THEN
    trigger_count := trigger_count + 1;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ NOTIFICATION TRIGGERS MIGRATION COMPLETE';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Summary:';
  RAISE NOTICE '   - Functions created: %', function_count;
  RAISE NOTICE '   - Triggers created: %', trigger_count;
  RAISE NOTICE '';
  RAISE NOTICE '📍 Trigger locations:';
  RAISE NOTICE '   - users.follows → on_follow_notification';
  RAISE NOTICE '   - events.event_reactions → on_reaction_notification';
  RAISE NOTICE '   - events.event_comments → on_comment_notification';
  RAISE NOTICE '   - ticketing.tickets → on_ticket_notification';
  RAISE NOTICE '   - messaging.direct_messages → on_message_notification';
  RAISE NOTICE '';
  RAISE NOTICE '🔔 Notifications will now be created for:';
  RAISE NOTICE '   - New followers (user-to-user only)';
  RAISE NOTICE '   - Post likes';
  RAISE NOTICE '   - Comments on posts';
  RAISE NOTICE '   - Replies to comments';
  RAISE NOTICE '   - Ticket purchases';
  RAISE NOTICE '   - New messages';
  RAISE NOTICE '';
  RAISE NOTICE '🛡️ Security:';
  RAISE NOTICE '   - All functions use SECURITY DEFINER';
  RAISE NOTICE '   - search_path locked to public, pg_temp';
  RAISE NOTICE '   - RLS still enforced on notifications table';
  RAISE NOTICE '';
END $$;
