-- Migration: Add Follow Safety Layer (Blocks + Private Accounts)
-- Created: 2025-11-11
-- Purpose: Add blocking system and private account controls for social safety

-- ============================================================================
-- 1. CREATE BLOCKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT, -- Optional: user-provided reason
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Prevent duplicate blocks
  UNIQUE (blocker_user_id, blocked_user_id),
  
  -- Prevent self-blocking
  CONSTRAINT no_self_block CHECK (blocker_user_id != blocked_user_id)
);

COMMENT ON TABLE public.blocks IS 'User blocking relationships for safety and harassment prevention';
COMMENT ON COLUMN public.blocks.reason IS 'Optional user-provided reason for blocking (not shown to blocked user)';

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON public.blocks(blocker_user_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON public.blocks(blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_blocks_pair ON public.blocks(blocker_user_id, blocked_user_id);

-- ============================================================================
-- 2. ADD PRIVATE ACCOUNT SUPPORT TO USER_PROFILES
-- ============================================================================

-- Add is_private column to user_profiles
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'users' 
    AND table_name = 'user_profiles' 
    AND column_name = 'is_private'
  ) THEN
    ALTER TABLE users.user_profiles 
    ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN users.user_profiles.is_private IS 'If true, all new follows require approval (status=pending)';

-- ============================================================================
-- 3. RLS POLICIES FOR BLOCKS TABLE
-- ============================================================================

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view blocks they created
CREATE POLICY "users_can_view_own_blocks"
  ON public.blocks
  FOR SELECT
  USING (auth.uid() = blocker_user_id);

-- Policy: Users can view blocks where they are the blocked party (know who blocked them)
-- Note: This is optional - you may want to hide this for privacy
-- CREATE POLICY "users_can_view_blocks_against_them"
--   ON public.blocks
--   FOR SELECT
--   USING (auth.uid() = blocked_user_id);

-- Policy: Users can create blocks
CREATE POLICY "users_can_block_others"
  ON public.blocks
  FOR INSERT
  WITH CHECK (auth.uid() = blocker_user_id);

-- Policy: Users can remove their own blocks (unblock)
CREATE POLICY "users_can_unblock"
  ON public.blocks
  FOR DELETE
  USING (auth.uid() = blocker_user_id);

-- ============================================================================
-- 4. HELPER FUNCTIONS FOR BLOCKING LOGIC
-- ============================================================================

-- Function: Check if user A has blocked user B
CREATE OR REPLACE FUNCTION public.is_user_blocked(
  blocker_id UUID,
  target_id UUID
) RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE blocker_user_id = blocker_id
      AND blocked_user_id = target_id
  );
$$;

COMMENT ON FUNCTION public.is_user_blocked IS 'Returns true if blocker_id has blocked target_id';

-- Function: Check if there is any block between two users (either direction)
CREATE OR REPLACE FUNCTION public.users_have_block(
  user_a UUID,
  user_b UUID
) RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_user_id = user_a AND blocked_user_id = user_b)
       OR (blocker_user_id = user_b AND blocked_user_id = user_a)
  );
$$;

COMMENT ON FUNCTION public.users_have_block IS 'Returns true if either user has blocked the other';

-- Function: Check if target user has private account
CREATE OR REPLACE FUNCTION public.is_user_private(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_private FROM users.user_profiles WHERE user_id = target_user_id),
    false
  );
$$;

COMMENT ON FUNCTION public.is_user_private IS 'Returns true if user has enabled private account mode';

-- ============================================================================
-- 5. UPDATE FOLLOWS TABLE RLS TO ENFORCE BLOCKING
-- ============================================================================

-- Drop ALL existing follow policies (we'll recreate with block enforcement)
DO $$ 
BEGIN
  -- New policy names (if they exist)
  DROP POLICY IF EXISTS "users_can_follow" ON users.follows;
  DROP POLICY IF EXISTS "users_can_unfollow" ON users.follows;
  DROP POLICY IF EXISTS "users_can_view_follows" ON users.follows;
  DROP POLICY IF EXISTS "users_can_update_own_follow_status" ON users.follows;
  DROP POLICY IF EXISTS "target_can_update_follow_status" ON users.follows;
  
  -- Existing policy names from current database
  DROP POLICY IF EXISTS "follows_delete_policy" ON users.follows;
  DROP POLICY IF EXISTS "follows_insert_policy" ON users.follows;
  DROP POLICY IF EXISTS "follows_select_policy" ON users.follows;
  DROP POLICY IF EXISTS "follows_update_policy" ON users.follows;
  DROP POLICY IF EXISTS "own_follows_all" ON users.follows;
  DROP POLICY IF EXISTS "public_follows_select" ON users.follows;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Policy: Users can view all follows (public social graph)
CREATE POLICY "users_can_view_follows"
  ON users.follows
  FOR SELECT
  USING (true); -- Public social graph

-- Policy: Users can create follows (with block check)
CREATE POLICY "users_can_follow"
  ON users.follows
  FOR INSERT
  WITH CHECK (
    -- Must be authenticated
    auth.uid() = follower_user_id
    -- Cannot follow if blocked or blocking
    AND NOT public.users_have_block(auth.uid(), target_id)
  );

-- Policy: Users can delete their own follows (unfollow)
CREATE POLICY "users_can_unfollow"
  ON users.follows
  FOR DELETE
  USING (auth.uid() = follower_user_id);

-- Policy: Only the target user can update follow status (accept/decline)
-- This is for user-to-user follows only
CREATE POLICY "target_can_update_follow_status"
  ON users.follows
  FOR UPDATE
  USING (
    auth.uid() = target_id 
    AND target_type = 'user'
  )
  WITH CHECK (
    auth.uid() = target_id 
    AND target_type = 'user'
  );

-- ============================================================================
-- 6. TRIGGER TO AUTO-SET FOLLOW STATUS BASED ON PRIVACY
-- ============================================================================

-- Function: Set follow status to 'pending' if target user is private
CREATE OR REPLACE FUNCTION public.set_follow_status_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- For user-to-user follows, check if target is private
  IF NEW.target_type = 'user' THEN
    IF public.is_user_private(NEW.target_id) THEN
      NEW.status := 'pending';
    ELSE
      -- If status not set, default to accepted for public users
      NEW.status := COALESCE(NEW.status, 'accepted');
    END IF;
  ELSE
    -- For organizer/event follows, always auto-accept
    NEW.status := 'accepted';
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_follow_status_on_insert IS 'Automatically sets follow status based on target privacy settings';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_set_follow_status ON users.follows;

-- Create trigger
CREATE TRIGGER trg_set_follow_status
  BEFORE INSERT ON users.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.set_follow_status_on_insert();

-- ============================================================================
-- 7. TRIGGER TO REMOVE FOLLOWS WHEN USERS BLOCK EACH OTHER
-- ============================================================================

-- Function: Remove existing follows when block is created
CREATE OR REPLACE FUNCTION public.cleanup_follows_on_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove any follows in either direction
  DELETE FROM users.follows
  WHERE (follower_user_id = NEW.blocker_user_id AND target_type = 'user' AND target_id = NEW.blocked_user_id)
     OR (follower_user_id = NEW.blocked_user_id AND target_type = 'user' AND target_id = NEW.blocker_user_id);
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cleanup_follows_on_block IS 'Removes mutual follows when a block is created';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_cleanup_follows_on_block ON public.blocks;

-- Create trigger
CREATE TRIGGER trg_cleanup_follows_on_block
  AFTER INSERT ON public.blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_follows_on_block();

-- ============================================================================
-- 8. UPDATE USER_SEARCH VIEW TO EXCLUDE BLOCKED USERS
-- ============================================================================

-- Drop existing view
DROP VIEW IF EXISTS public.user_search CASCADE;

-- Recreate with block filtering
CREATE OR REPLACE VIEW public.user_search AS
SELECT 
  up.user_id,
  up.display_name,
  up.photo_url,
  up.bio,
  up.location,
  up.is_private,
  (
    SELECT COUNT(*) 
    FROM users.follows f 
    WHERE f.target_type = 'user' 
      AND f.target_id = up.user_id 
      AND f.status = 'accepted'
  ) AS follower_count,
  (
    SELECT COUNT(*) 
    FROM users.follows f 
    WHERE f.follower_user_id = up.user_id 
      AND f.status = 'accepted'
  ) AS following_count,
  (
    SELECT f.status
    FROM users.follows f
    WHERE f.follower_user_id = auth.uid()
      AND f.target_type = 'user'
      AND f.target_id = up.user_id
  ) AS current_user_follow_status,
  -- Add block status
  public.users_have_block(auth.uid(), up.user_id) AS is_blocked
FROM users.user_profiles up
WHERE 
  -- Exclude current user from search results
  up.user_id != COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  -- Exclude blocked users (either direction)
  AND NOT public.users_have_block(auth.uid(), up.user_id);

COMMENT ON VIEW public.user_search IS 'User search view with follow stats and block filtering';

-- Grant access
GRANT SELECT ON public.user_search TO authenticated;
GRANT SELECT ON public.user_search TO anon;

-- ============================================================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index on is_private for faster privacy checks
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_private 
  ON users.user_profiles(is_private) 
  WHERE is_private = true; -- Partial index, only for private accounts

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

-- Grant table access
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;

-- Grant function execute permissions
GRANT EXECUTE ON FUNCTION public.is_user_blocked TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.users_have_block TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_user_private TO authenticated, anon;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Follow safety layer migration complete:';
  RAISE NOTICE '   - Blocks table created with RLS';
  RAISE NOTICE '   - Private account support added';
  RAISE NOTICE '   - Follows RLS updated to enforce blocking';
  RAISE NOTICE '   - Auto-status trigger added for private accounts';
  RAISE NOTICE '   - Follow cleanup trigger added for blocks';
  RAISE NOTICE '   - user_search view updated with block filtering';
END $$;

