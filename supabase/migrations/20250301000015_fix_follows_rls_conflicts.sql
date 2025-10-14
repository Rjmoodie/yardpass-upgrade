-- Fix conflicting RLS policies on follows table
-- There are multiple policies that might be conflicting

-- First, let's clean up all existing policies
DROP POLICY IF EXISTS "follows_read_all" ON public.follows;
DROP POLICY IF EXISTS "follows_insert_own" ON public.follows;
DROP POLICY IF EXISTS "follows_delete_own" ON public.follows;
DROP POLICY IF EXISTS "follows_update_actor" ON public.follows;
DROP POLICY IF EXISTS "users_can_follow_other_users" ON public.follows;
DROP POLICY IF EXISTS "users_can_manage_their_follows" ON public.follows;
DROP POLICY IF EXISTS "users_can_see_follow_requests" ON public.follows;

-- Create comprehensive, non-conflicting policies
CREATE POLICY "follows_select_policy" ON public.follows
FOR SELECT USING (
  -- Users can see follows where they are the follower
  follower_user_id = auth.uid()
  OR 
  -- Users can see follows where they are the target (for follow requests)
  (target_type = 'user' AND target_id = auth.uid())
  OR
  -- Users can see public follows (organizer/event follows)
  target_type IN ('organizer', 'event')
);

CREATE POLICY "follows_insert_policy" ON public.follows
FOR INSERT WITH CHECK (
  -- Users can only create follows for themselves
  follower_user_id = auth.uid()
  AND
  -- Can't follow yourself
  (target_type != 'user' OR target_id != auth.uid())
);

CREATE POLICY "follows_update_policy" ON public.follows
FOR UPDATE USING (
  -- Users can update their own follows
  follower_user_id = auth.uid()
) WITH CHECK (
  -- Can only update status to valid values
  status IN ('pending', 'accepted', 'declined')
  AND
  -- Can't change the follower or target
  follower_user_id = auth.uid()
);

CREATE POLICY "follows_delete_policy" ON public.follows
FOR DELETE USING (
  -- Users can delete their own follows
  follower_user_id = auth.uid()
  OR
  -- Users can delete follows targeting them (decline follow requests)
  (target_type = 'user' AND target_id = auth.uid())
);
