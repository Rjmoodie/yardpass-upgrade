-- Migration: Create Messaging System
-- Created: 2025-11-11
-- Purpose: Deploy complete messaging infrastructure for user-to-user and org-to-user DMs

-- ============================================================================
-- 1. CREATE MESSAGING SCHEMA
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS messaging;

COMMENT ON SCHEMA messaging IS 'Direct messaging system for users and organizations';

-- ============================================================================
-- 2. CREATE ENUMS
-- ============================================================================

-- Enum: Conversation participant type
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_participant_type') THEN
    CREATE TYPE public.conversation_participant_type AS ENUM ('user', 'organization');
  END IF;
END $$;

-- Enum: Conversation request status
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_request_status') THEN
    CREATE TYPE public.conversation_request_status AS ENUM ('open', 'pending', 'accepted', 'declined');
  END IF;
END $$;

-- ============================================================================
-- 3. CREATE TABLES
-- ============================================================================

-- Table: direct_conversations
CREATE TABLE IF NOT EXISTS messaging.direct_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT,
  request_status public.conversation_request_status NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

COMMENT ON TABLE messaging.direct_conversations IS 'Direct message conversations between users and/or organizations';
COMMENT ON COLUMN messaging.direct_conversations.request_status IS 'Approval status: open (no approval needed), pending (awaiting approval), accepted, declined';
COMMENT ON COLUMN messaging.direct_conversations.metadata IS 'Flexible JSON storage for conversation context (e.g., event_id, initial_message_id)';

-- Table: conversation_participants
CREATE TABLE IF NOT EXISTS messaging.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES messaging.direct_conversations(id) ON DELETE CASCADE,
  participant_type public.conversation_participant_type NOT NULL,
  participant_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  
  -- Primary key: each participant type can only be in a conversation once
  PRIMARY KEY (conversation_id, participant_type, COALESCE(participant_user_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(participant_org_id, '00000000-0000-0000-0000-000000000000'::uuid)),
  
  -- Constraint: Must have either user_id OR org_id (not both, not neither)
  CONSTRAINT participant_identity_check CHECK (
    (participant_type = 'user' AND participant_user_id IS NOT NULL AND participant_org_id IS NULL) OR
    (participant_type = 'organization' AND participant_org_id IS NOT NULL AND participant_user_id IS NULL)
  )
);

COMMENT ON TABLE messaging.conversation_participants IS 'Maps users/orgs to conversations they participate in';
COMMENT ON COLUMN messaging.conversation_participants.last_read_at IS 'Timestamp of last message this participant read (for unread counts)';

-- Table: direct_messages
CREATE TABLE IF NOT EXISTS messaging.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES messaging.direct_conversations(id) ON DELETE CASCADE,
  sender_type public.conversation_participant_type NOT NULL,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  attachments JSONB, -- Future: array of {url, type, size}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'read' (future)
  
  -- Constraint: Must have either sender_user_id OR sender_org_id
  CONSTRAINT sender_identity_check CHECK (
    (sender_type = 'user' AND sender_user_id IS NOT NULL AND sender_org_id IS NULL) OR
    (sender_type = 'organization' AND sender_org_id IS NOT NULL AND sender_user_id IS NULL)
  )
);

COMMENT ON TABLE messaging.direct_messages IS 'Individual messages within conversations';
COMMENT ON COLUMN messaging.direct_messages.body IS 'Message content (text)';
COMMENT ON COLUMN messaging.direct_messages.attachments IS 'JSON array of attachments (URLs, metadata)';
COMMENT ON COLUMN messaging.direct_messages.status IS 'Delivery status: sent, delivered, read';

-- ============================================================================
-- 4. CREATE INDEXES
-- ============================================================================

-- Conversations
CREATE INDEX IF NOT EXISTS idx_direct_conversations_created_by 
  ON messaging.direct_conversations(created_by);

CREATE INDEX IF NOT EXISTS idx_direct_conversations_last_message_at 
  ON messaging.direct_conversations(last_message_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_direct_conversations_request_status 
  ON messaging.direct_conversations(request_status);

-- Participants
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user 
  ON messaging.conversation_participants(participant_user_id) 
  WHERE participant_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_participants_org 
  ON messaging.conversation_participants(participant_org_id) 
  WHERE participant_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation 
  ON messaging.conversation_participants(conversation_id);

-- Messages
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created 
  ON messaging.direct_messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_user 
  ON messaging.direct_messages(sender_user_id) 
  WHERE sender_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_org 
  ON messaging.direct_messages(sender_org_id) 
  WHERE sender_org_id IS NOT NULL;

-- ============================================================================
-- 5. CREATE TRIGGERS
-- ============================================================================

-- Trigger: Update last_message_at when new message is sent
CREATE OR REPLACE FUNCTION messaging.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE messaging.direct_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conversation_last_message ON messaging.direct_messages;

CREATE TRIGGER trg_update_conversation_last_message
  AFTER INSERT ON messaging.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION messaging.update_conversation_last_message();

COMMENT ON FUNCTION messaging.update_conversation_last_message IS 'Updates conversation last_message_at timestamp when new message is sent';

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE messaging.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging.direct_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CONVERSATIONS POLICIES
-- ============================================================================

-- Policy: Users can view conversations they participate in
CREATE POLICY "participants_can_view_conversations"
  ON messaging.direct_conversations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM messaging.conversation_participants cp
      WHERE cp.conversation_id = direct_conversations.id
        AND (
          (cp.participant_type = 'user' AND cp.participant_user_id = auth.uid())
          OR
          (cp.participant_type = 'organization' AND cp.participant_org_id IN (
            SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
          ))
        )
    )
  );

-- Policy: Authenticated users can create conversations
CREATE POLICY "authenticated_can_create_conversations"
  ON messaging.direct_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Policy: Participants can update conversation status (accept/decline)
CREATE POLICY "participants_can_update_status"
  ON messaging.direct_conversations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 
      FROM messaging.conversation_participants cp
      WHERE cp.conversation_id = direct_conversations.id
        AND (
          (cp.participant_type = 'user' AND cp.participant_user_id = auth.uid())
          OR
          (cp.participant_type = 'organization' AND cp.participant_org_id IN (
            SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
          ))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM messaging.conversation_participants cp
      WHERE cp.conversation_id = direct_conversations.id
        AND (
          (cp.participant_type = 'user' AND cp.participant_user_id = auth.uid())
          OR
          (cp.participant_type = 'organization' AND cp.participant_org_id IN (
            SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
          ))
        )
    )
  );

-- ============================================================================
-- PARTICIPANTS POLICIES
-- ============================================================================

-- Policy: Users can view participants in their conversations
CREATE POLICY "participants_can_view_members"
  ON messaging.conversation_participants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM messaging.conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
        AND (
          (cp2.participant_type = 'user' AND cp2.participant_user_id = auth.uid())
          OR
          (cp2.participant_type = 'organization' AND cp2.participant_org_id IN (
            SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
          ))
        )
    )
  );

-- Policy: Creator can add participants when creating conversation
CREATE POLICY "creator_can_add_participants"
  ON messaging.conversation_participants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM messaging.direct_conversations dc
      WHERE dc.id = conversation_participants.conversation_id
        AND dc.created_by = auth.uid()
    )
  );

-- Policy: Participants can update their own last_read_at
CREATE POLICY "participants_can_update_own_read_status"
  ON messaging.conversation_participants
  FOR UPDATE
  USING (
    (participant_type = 'user' AND participant_user_id = auth.uid())
    OR
    (participant_type = 'organization' AND participant_org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
    ))
  )
  WITH CHECK (
    (participant_type = 'user' AND participant_user_id = auth.uid())
    OR
    (participant_type = 'organization' AND participant_org_id IN (
      SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
    ))
  );

-- ============================================================================
-- MESSAGES POLICIES
-- ============================================================================

-- Policy: Participants can view messages in their conversations
CREATE POLICY "participants_can_view_messages"
  ON messaging.direct_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM messaging.conversation_participants cp
      WHERE cp.conversation_id = direct_messages.conversation_id
        AND (
          (cp.participant_type = 'user' AND cp.participant_user_id = auth.uid())
          OR
          (cp.participant_type = 'organization' AND cp.participant_org_id IN (
            SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
          ))
        )
    )
  );

-- Policy: Participants can send messages to their conversations
CREATE POLICY "participants_can_send_messages"
  ON messaging.direct_messages
  FOR INSERT
  WITH CHECK (
    -- Must be a participant
    EXISTS (
      SELECT 1 
      FROM messaging.conversation_participants cp
      WHERE cp.conversation_id = direct_messages.conversation_id
        AND (
          (cp.participant_type = 'user' AND cp.participant_user_id = auth.uid())
          OR
          (cp.participant_type = 'organization' AND cp.participant_org_id IN (
            SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
          ))
        )
    )
    -- Conversation must not be declined
    AND EXISTS (
      SELECT 1 
      FROM messaging.direct_conversations dc
      WHERE dc.id = direct_messages.conversation_id
        AND dc.request_status != 'declined'
    )
    -- Sender identity must match auth
    AND (
      (sender_type = 'user' AND sender_user_id = auth.uid())
      OR
      (sender_type = 'organization' AND sender_org_id IN (
        SELECT org_id FROM public.org_memberships WHERE user_id = auth.uid()
      ))
    )
  );

-- Policy: No message updates or deletes (enforce immutability for v1)
-- Future: Add soft delete or edit history if needed

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function: Get unread message count for a user
CREATE OR REPLACE FUNCTION messaging.get_unread_count(target_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  unread_count BIGINT
)
LANGUAGE SQL STABLE
AS $$
  SELECT 
    dm.conversation_id,
    COUNT(*) AS unread_count
  FROM messaging.direct_messages dm
  INNER JOIN messaging.conversation_participants cp 
    ON cp.conversation_id = dm.conversation_id
    AND cp.participant_type = 'user'
    AND cp.participant_user_id = target_user_id
  WHERE dm.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
    AND dm.sender_user_id != target_user_id -- Don't count own messages
  GROUP BY dm.conversation_id;
$$;

COMMENT ON FUNCTION messaging.get_unread_count IS 'Returns unread message counts per conversation for a user';

-- Function: Check if messaging is enabled between two parties (respects blocks)
CREATE OR REPLACE FUNCTION messaging.can_message(
  sender_user_id UUID,
  target_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT NOT public.users_have_block(sender_user_id, target_user_id);
$$;

COMMENT ON FUNCTION messaging.can_message IS 'Returns false if there is a block between users';

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

-- Schema
GRANT USAGE ON SCHEMA messaging TO authenticated;

-- Tables
GRANT SELECT, INSERT, UPDATE ON messaging.direct_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON messaging.conversation_participants TO authenticated;
GRANT SELECT, INSERT ON messaging.direct_messages TO authenticated;

-- Functions
GRANT EXECUTE ON FUNCTION messaging.get_unread_count TO authenticated;
GRANT EXECUTE ON FUNCTION messaging.can_message TO authenticated;

-- ============================================================================
-- 9. RATE LIMITING (OPTIONAL - ENABLE IF NEEDED)
-- ============================================================================

-- Table: Track message rate limits
CREATE TABLE IF NOT EXISTS messaging.message_rate_limits (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, window_start)
);

CREATE INDEX IF NOT EXISTS idx_message_rate_limits_user_window 
  ON messaging.message_rate_limits(user_id, window_start DESC);

COMMENT ON TABLE messaging.message_rate_limits IS 'Track message sending rate per user (1-hour windows)';

-- Function: Check and enforce rate limit (200 messages per hour)
CREATE OR REPLACE FUNCTION messaging.check_message_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_window TIMESTAMPTZ;
  message_count INT;
  max_messages_per_hour INT := 200;
BEGIN
  -- Only rate limit user messages (not org messages)
  IF NEW.sender_type = 'user' AND NEW.sender_user_id IS NOT NULL THEN
    current_window := date_trunc('hour', now());
    
    -- Get current count for this hour
    SELECT COALESCE(SUM(message_count), 0)
    INTO message_count
    FROM messaging.message_rate_limits
    WHERE user_id = NEW.sender_user_id
      AND window_start >= current_window;
    
    -- Check if over limit
    IF message_count >= max_messages_per_hour THEN
      RAISE EXCEPTION 'Rate limit exceeded: Maximum % messages per hour', max_messages_per_hour;
    END IF;
    
    -- Increment counter
    INSERT INTO messaging.message_rate_limits (user_id, window_start, message_count)
    VALUES (NEW.sender_user_id, current_window, 1)
    ON CONFLICT (user_id, window_start)
    DO UPDATE SET message_count = message_rate_limits.message_count + 1;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Enable rate limiting trigger (commented out by default - enable if needed)
-- DROP TRIGGER IF EXISTS trg_check_message_rate_limit ON messaging.direct_messages;
-- CREATE TRIGGER trg_check_message_rate_limit
--   BEFORE INSERT ON messaging.direct_messages
--   FOR EACH ROW
--   EXECUTE FUNCTION messaging.check_message_rate_limit();

COMMENT ON FUNCTION messaging.check_message_rate_limit IS 'Enforces 200 messages per hour limit per user (disabled by default)';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Messaging system migration complete:';
  RAISE NOTICE '   - messaging schema created';
  RAISE NOTICE '   - direct_conversations, conversation_participants, direct_messages tables created';
  RAISE NOTICE '   - RLS policies enabled (participant-only access)';
  RAISE NOTICE '   - Indexes for fast queries';
  RAISE NOTICE '   - Triggers for last_message_at updates';
  RAISE NOTICE '   - Helper functions for unread counts and block checks';
  RAISE NOTICE '   - Rate limiting infrastructure (disabled by default)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  Next steps:';
  RAISE NOTICE '   1. Enable messaging in frontend with feature flag';
  RAISE NOTICE '   2. Setup realtime subscriptions for new messages';
  RAISE NOTICE '   3. Test messaging between users and orgs';
  RAISE NOTICE '   4. Consider enabling rate limiting if abuse occurs';
END $$;


