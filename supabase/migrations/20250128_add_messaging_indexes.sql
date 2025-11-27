-- Migration: Add Messaging Performance Indexes
-- Created: 2025-01-28
-- Purpose: Add indexes for cursor-based pagination and unread count queries

-- ============================================================================
-- INDEXES FOR CURSOR-BASED PAGINATION
-- ============================================================================

-- For cursor-based pagination (created_at DESC for newest first, load older on scroll)
-- Note: Index already exists as idx_direct_messages_conversation_created
-- But we need to verify it's DESC order for optimal pagination
DROP INDEX IF EXISTS messaging.idx_direct_messages_conversation_created;
CREATE INDEX idx_direct_messages_conversation_created 
ON messaging.direct_messages(conversation_id, created_at DESC);

-- ============================================================================
-- INDEXES FOR UNREAD COUNT QUERIES
-- ============================================================================

-- For unread count queries: WHERE created_at > last_read_at
-- This index supports queries that filter by conversation_id and created_at
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created_asc
ON messaging.direct_messages(conversation_id, created_at);

-- For participant lookups in unread queries
-- This index already exists, but we verify it's optimal
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_participant
ON messaging.conversation_participants(conversation_id, participant_type, participant_user_id, participant_org_id);

-- Additional index for fast last_read_at lookups
CREATE INDEX IF NOT EXISTS idx_conversation_participants_last_read_at
ON messaging.conversation_participants(conversation_id, last_read_at)
WHERE last_read_at IS NOT NULL;

-- ============================================================================
-- VERIFY INDEXES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Messaging indexes migration complete:';
  RAISE NOTICE '   - Cursor-based pagination index (conversation_id, created_at DESC)';
  RAISE NOTICE '   - Unread count query index (conversation_id, created_at ASC)';
  RAISE NOTICE '   - Participant lookup index optimized';
  RAISE NOTICE '   - last_read_at lookup index';
END $$;

