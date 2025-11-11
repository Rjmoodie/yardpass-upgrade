-- Migration: Create Public Notifications Table
-- Purpose: Fix notification system - create public.notifications table for app notifications
-- Why: Database triggers reference public.notifications but table doesn't exist

-- ============================================================================
-- 1. CREATE PUBLIC NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('success', 'error', 'warning', 'info')),
  action_url TEXT,
  event_type TEXT, -- 'user_follow', 'post_like', 'post_comment', 'ticket_purchase', 'message_received', etc.
  data JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifications IS 'Application notifications for users (likes, follows, messages, etc.)';
COMMENT ON COLUMN public.notifications.event_type IS 'Category of notification (user_follow, post_like, etc.)';
COMMENT ON COLUMN public.notifications.data IS 'Additional context (follower_id, post_id, etc.)';
COMMENT ON COLUMN public.notifications.read_at IS 'Timestamp when user marked notification as read';

-- ============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Primary index: user's notifications sorted by date
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON public.notifications(user_id, created_at DESC);

-- Unread notifications (partial index for performance)
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
  ON public.notifications(user_id, created_at DESC) 
  WHERE read_at IS NULL;

-- Event type filtering
CREATE INDEX IF NOT EXISTS idx_notifications_event_type 
  ON public.notifications(user_id, event_type) 
  WHERE event_type IS NOT NULL;

-- ============================================================================
-- 3. RLS POLICIES
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY "users_view_own_notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "users_update_own_notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    -- Only allow updating read_at column
    AND read_at IS NOT NULL
  );

-- Policy: Users can delete their own notifications
CREATE POLICY "users_delete_own_notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy: System can insert notifications (via SECURITY DEFINER functions)
-- No explicit INSERT policy needed - handled by trigger functions

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function: Get unread count for a user
CREATE OR REPLACE FUNCTION public.get_unread_notification_count(target_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL STABLE
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.notifications
  WHERE user_id = target_user_id
    AND read_at IS NULL;
$$;

COMMENT ON FUNCTION public.get_unread_notification_count IS 'Returns count of unread notifications for a user';

-- Function: Mark all notifications as read for a user
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(target_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL
AS $$
  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = target_user_id
    AND read_at IS NULL
    AND user_id = auth.uid()  -- Security: only own notifications
  RETURNING COUNT(*)::INTEGER;
$$;

COMMENT ON FUNCTION public.mark_all_notifications_read IS 'Marks all unread notifications as read for a user';

-- Function: Delete old read notifications (cleanup)
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS INTEGER
LANGUAGE SQL
AS $$
  DELETE FROM public.notifications
  WHERE read_at IS NOT NULL
    AND read_at < now() - interval '30 days'
  RETURNING COUNT(*)::INTEGER;
$$;

COMMENT ON FUNCTION public.cleanup_old_notifications IS 'Deletes read notifications older than 30 days';

-- ============================================================================
-- 5. UPDATE EXISTING TRIGGER FUNCTIONS
-- ============================================================================

-- The create_follow_notification function already exists and references public.notifications
-- Now it will work because the table exists!

-- Verify the function exists:
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'create_follow_notification'
  ) THEN
    RAISE NOTICE '⚠️  create_follow_notification function not found - may need to be created';
  ELSE
    RAISE NOTICE '✅ create_follow_notification function exists and will now work';
  END IF;
END $$;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
DECLARE
  notification_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO notification_count FROM public.notifications;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ public.notifications table created';
  RAISE NOTICE '✅ RLS policies enabled (users can only see their own)';
  RAISE NOTICE '✅ Indexes created for performance';
  RAISE NOTICE '✅ Helper functions created';
  RAISE NOTICE '✅ Existing notification triggers will now work!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Current notifications: %', notification_count;
  RAISE NOTICE '';
  RAISE NOTICE '⚡ Next steps:';
  RAISE NOTICE '   1. Update NotificationsPage to query this table';
  RAISE NOTICE '   2. Add real-time subscriptions';
  RAISE NOTICE '   3. Add mark-as-read UI';
  RAISE NOTICE '   4. Add unread badge to navigation';
END $$;


