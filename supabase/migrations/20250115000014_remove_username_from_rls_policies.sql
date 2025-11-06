-- Remove username checks from RLS policies
-- Username validation will be handled at the application layer (frontend + Edge Functions)
-- RLS policies should only check: authenticated + user_id matching

-- ============================================
-- EVENT_COMMENTS: Simple authenticated check
-- ============================================

-- Drop the policy with username check (causes view RLS conflicts)
DROP POLICY IF EXISTS "authenticated_users_can_comment" ON events.event_comments;

-- The existing "event_comments_insert" policy is sufficient:
-- WITH CHECK: (author_user_id = auth.uid())
-- This allows any authenticated user to comment

COMMENT ON POLICY "event_comments_insert" ON events.event_comments IS
  'Allow authenticated users to comment - username validation done at app layer';

-- ============================================
-- EVENT_REACTIONS: Simple authenticated check
-- ============================================

-- Drop the policy with username check (causes view RLS conflicts)
DROP POLICY IF EXISTS "authenticated_users_can_react" ON events.event_reactions;

-- The existing policies are sufficient:
-- "event_reactions_insert_self": WITH CHECK (user_id = auth.uid())
-- "reactions_insert_simple": WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid())

COMMENT ON POLICY "event_reactions_insert_self" ON events.event_reactions IS
  'Allow authenticated users to react - username validation done at app layer';

-- ============================================
-- USERNAME VALIDATION HAPPENS IN:
-- 1. Frontend: ProfileCompletionModal shown before API calls
-- 2. Backend: reactions-toggle Edge Function checks username
-- 3. Backend: posts-create Edge Function checks username  
-- ============================================

