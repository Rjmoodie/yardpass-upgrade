-- Fix Console Errors: Create missing tables and public synonyms
-- This migration fixes:
-- 1. event_impressions 404 error (table exists in events schema, need public synonym)
-- 2. notifications 404 error (table doesn't exist, need to create it)

-- ============================================================================
-- 1. CREATE PUBLIC VIEWS FOR IMPRESSIONS TABLES
-- ============================================================================
-- These tables exist in events schema, but frontend expects them in public
-- Create public views as synonyms

DROP VIEW IF EXISTS public.event_impressions CASCADE;
CREATE VIEW public.event_impressions AS
SELECT * FROM events.event_impressions;

DROP VIEW IF EXISTS public.post_impressions CASCADE;
CREATE VIEW public.post_impressions AS
SELECT * FROM events.post_impressions;

-- Grant permissions
GRANT SELECT, INSERT ON events.event_impressions TO authenticated, anon;
GRANT SELECT, INSERT ON events.post_impressions TO authenticated, anon;

-- ============================================================================
-- CREATE RPC FUNCTIONS FOR INSERTING IMPRESSIONS
-- ============================================================================
-- PostgREST can't access non-public schemas directly via .schema()
-- So we create public RPC functions to insert into events schema

CREATE OR REPLACE FUNCTION public.insert_event_impressions(impressions JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = events, public
AS $$
BEGIN
  INSERT INTO events.event_impressions (event_id, user_id, session_id, dwell_ms, completed)
  SELECT 
    (imp->>'event_id')::UUID,
    (imp->>'user_id')::UUID,
    imp->>'session_id',
    (imp->>'dwell_ms')::INTEGER,
    (imp->>'completed')::BOOLEAN
  FROM jsonb_array_elements(impressions) AS imp
  ON CONFLICT (event_id, session_id, hour_bucket) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_post_impressions(impressions JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = events, public
AS $$
BEGIN
  INSERT INTO events.post_impressions (post_id, event_id, user_id, session_id, dwell_ms, completed)
  SELECT 
    (imp->>'post_id')::UUID,
    (imp->>'event_id')::UUID,
    (imp->>'user_id')::UUID,
    imp->>'session_id',
    (imp->>'dwell_ms')::INTEGER,
    (imp->>'completed')::BOOLEAN
  FROM jsonb_array_elements(impressions) AS imp
  ON CONFLICT (post_id, session_id, hour_bucket) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_event_impressions TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.insert_post_impressions TO authenticated, anon;

-- ============================================================================
-- 2. CREATE NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('success', 'error', 'warning', 'info')),
  read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  event_type TEXT,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
  ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
  ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread 
  ON public.notifications(user_id, read) 
  WHERE read = false;

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only see and manage their own notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 3. HELPER FUNCTION TO MARK NOTIFICATION AS READ
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET 
    read = true,
    read_at = now()
  WHERE id = p_notification_id
    AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read TO authenticated;

-- ============================================================================
-- 4. HELPER FUNCTION TO MARK ALL NOTIFICATIONS AS READ
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET 
    read = true,
    read_at = now()
  WHERE user_id = auth.uid()
    AND read = false;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read TO authenticated;

-- ============================================================================
-- 5. CLEANUP FUNCTION FOR OLD NOTIFICATIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete read notifications older than 30 days
  DELETE FROM public.notifications
  WHERE read = true
    AND created_at < now() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_notifications TO authenticated;

COMMENT ON TABLE public.notifications IS 
  'User notifications for in-app alerts and messages';

COMMENT ON FUNCTION public.mark_notification_read IS 
  'Mark a single notification as read';

COMMENT ON FUNCTION public.mark_all_notifications_read IS 
  'Mark all user notifications as read, returns count updated';

COMMENT ON FUNCTION public.cleanup_old_notifications IS 
  'Delete read notifications older than 30 days';

