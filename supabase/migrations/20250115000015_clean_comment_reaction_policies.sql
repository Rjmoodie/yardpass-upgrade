-- Clean up all INSERT policies on event_comments and event_reactions
-- Goal: ANY authenticated user can comment/like (no ticket required)
-- Username validation happens at app layer only

-- ============================================
-- EVENT_COMMENTS: Drop ALL existing INSERT policies, create ONE clean policy
-- ============================================

DROP POLICY IF EXISTS "event_comments_insert" ON events.event_comments;
DROP POLICY IF EXISTS "event_comments_insert_authorized" ON events.event_comments;
DROP POLICY IF EXISTS "authenticated_users_can_comment" ON events.event_comments;

-- Single, simple INSERT policy
CREATE POLICY "comments_insert_any_authenticated"
  ON events.event_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (author_user_id = auth.uid());

COMMENT ON POLICY "comments_insert_any_authenticated" ON events.event_comments IS
  'Any authenticated user can comment - no ticket required. Username validated at app layer.';

-- ============================================
-- EVENT_REACTIONS: Drop ALL existing INSERT policies, create ONE clean policy
-- ============================================

DROP POLICY IF EXISTS "event_reactions_insert_self" ON events.event_reactions;
DROP POLICY IF EXISTS "reactions_insert_simple" ON events.event_reactions;
DROP POLICY IF EXISTS "authenticated_users_can_react" ON events.event_reactions;
DROP POLICY IF EXISTS "event_reactions_own" ON events.event_reactions CASCADE;

-- Single, simple INSERT policy for reactions
CREATE POLICY "reactions_insert_any_authenticated"
  ON events.event_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY "reactions_insert_any_authenticated" ON events.event_reactions IS
  'Any authenticated user can react/like - no ticket required. Username validated at app layer.';

-- Recreate the ALL policy for reactions (for SELECT/DELETE)
CREATE POLICY "reactions_own_data"
  ON events.event_reactions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- Summary: Clean slate for comments and likes
-- - RLS: Only checks authenticated + user_id match
-- - Username: Validated in frontend + Edge Functions
-- - Tickets: NOT required for comments/likes (only for posts)
-- ============================================

