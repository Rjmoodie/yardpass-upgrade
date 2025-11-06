-- Simplify comment and like permissions
-- Comments & Likes: Any authenticated user with username can engage
-- Posts: Require ticket or organizer status

-- ============================================
-- EVENT_COMMENTS: Allow any authenticated user with username
-- ============================================

-- Drop the restrictive policy
DROP POLICY IF EXISTS "event_comments_insert_authorized" ON events.event_comments;

-- Create simpler policy: authenticated users can comment if they have a username
CREATE POLICY "authenticated_users_can_comment" 
  ON events.event_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.username IS NOT NULL
        AND up.username != ''
    )
  );

-- Keep the existing simple insert policy for backwards compatibility
-- (it just checks author_user_id = auth.uid())

COMMENT ON POLICY "authenticated_users_can_comment" ON events.event_comments IS
  'Allow any authenticated user with a username to comment on posts';

-- ============================================
-- EVENT_REACTIONS: Allow any authenticated user with username
-- ============================================

-- Drop old restrictive policies if they exist
DROP POLICY IF EXISTS "reactions_insert_authorized" ON events.event_reactions;

-- Create simpler policy: authenticated users can like if they have a username
CREATE POLICY "authenticated_users_can_react" 
  ON events.event_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = auth.uid()
        AND up.username IS NOT NULL
        AND up.username != ''
    )
  );

COMMENT ON POLICY "authenticated_users_can_react" ON events.event_reactions IS
  'Allow any authenticated user with a username to like/react to posts';

-- ============================================
-- IMPORTANT: Event POSTS still require tickets or organizer status
-- (Those policies are handled separately in event_posts table)
-- ============================================

