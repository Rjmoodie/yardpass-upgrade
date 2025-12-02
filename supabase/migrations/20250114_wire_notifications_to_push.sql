-- ============================================================================
-- Migration: Wire Notifications to Push Notifications
-- Purpose: Automatically send push notifications when notifications are created
-- Author: AI Assistant
-- Date: 2025-01-14
-- Status: ⚠️ PENDING DEPLOYMENT - Deploy via Supabase Dashboard SQL Editor
-- Dependencies: Requires 20250114_create_notification_preferences.sql (deploy #2 first)
-- ============================================================================

-- Function to send push notification when notification is created
CREATE OR REPLACE FUNCTION public.send_push_for_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs RECORD;
  v_should_send BOOLEAN := false;
  v_user_devices UUID[];
BEGIN
  -- Skip if notification is already read (user might have seen it in-app)
  IF NEW.read_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get user's notification preferences
  SELECT * INTO v_prefs
  FROM public.get_notification_preferences(NEW.user_id)
  LIMIT 1;

  -- Determine if we should send push based on event type and preferences
  CASE NEW.event_type
    WHEN 'message_received' THEN
      v_should_send := v_prefs.push_messages;
    WHEN 'ticket_purchase' THEN
      v_should_send := v_prefs.push_tickets;
    WHEN 'user_follow', 'post_like', 'post_comment', 'comment_reply' THEN
      v_should_send := v_prefs.push_social;
    WHEN 'event_update' THEN
      -- Event updates always send (important)
      v_should_send := true;
    ELSE
      -- Unknown types: default to true for important notifications
      v_should_send := true;
  END CASE;

  -- If user has opted out, don't send
  IF NOT v_should_send THEN
    RETURN NEW;
  END IF;

  -- Get active device tokens for user
  SELECT ARRAY_AGG(push_token) INTO v_user_devices
  FROM public.user_devices
  WHERE user_id = NEW.user_id
    AND active = true
    AND push_token IS NOT NULL;

  -- If no devices, skip
  IF v_user_devices IS NULL OR array_length(v_user_devices, 1) = 0 THEN
    RETURN NEW;
  END IF;

  -- Call Edge Function to send push notification
  -- Note: This uses pg_net extension if available, otherwise logs for manual processing
  BEGIN
    PERFORM
      net.http_post(
        url := current_setting('app.supabase_url', true) || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
        ),
        body := jsonb_build_object(
          'user_id', NEW.user_id::text,
          'title', NEW.title,
          'body', NEW.message,
          'data', jsonb_build_object(
            'notification_id', NEW.id::text,
            'event_type', NEW.event_type,
            'action_url', NEW.action_url
          ) || COALESCE(NEW.data, '{}'::jsonb)
        )
      );
  EXCEPTION WHEN OTHERS THEN
    -- If pg_net is not available or fails, log for manual processing
    -- In production, you might want to queue this for an Edge Function
    RAISE LOG '[Push Notification] Failed to send push for notification %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.send_push_for_notification IS 
'Trigger function to send push notifications when notifications are created';

-- Create trigger
DROP TRIGGER IF EXISTS on_notification_created_send_push ON public.notifications;

CREATE TRIGGER on_notification_created_send_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.read_at IS NULL)  -- Only send for unread notifications
  EXECUTE FUNCTION public.send_push_for_notification();

COMMENT ON TRIGGER on_notification_created_send_push ON public.notifications IS
'Sends push notification when a new unread notification is created';

-- Alternative: If pg_net is not available, create a queue table for Edge Function processing
CREATE TABLE IF NOT EXISTS public.push_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_queue_pending 
  ON public.push_notification_queue(status, created_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_push_queue_user_id 
  ON public.push_notification_queue(user_id);

-- Enable RLS
ALTER TABLE public.push_notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own queued notifications
CREATE POLICY "Users can view own push queue"
  ON public.push_notification_queue
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Function to queue push notification (alternative to direct pg_net call)
CREATE OR REPLACE FUNCTION public.queue_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefs RECORD;
  v_should_send BOOLEAN := false;
BEGIN
  -- Skip if notification is already read
  IF NEW.read_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get user's notification preferences
  SELECT * INTO v_prefs
  FROM public.get_notification_preferences(NEW.user_id)
  LIMIT 1;

  -- Determine if we should send push
  CASE NEW.event_type
    WHEN 'message_received' THEN
      v_should_send := v_prefs.push_messages;
    WHEN 'ticket_purchase' THEN
      v_should_send := v_prefs.push_tickets;
    WHEN 'user_follow', 'post_like', 'post_comment', 'comment_reply' THEN
      v_should_send := v_prefs.push_social;
    WHEN 'event_update' THEN
      v_should_send := true;
    ELSE
      v_should_send := true;
  END CASE;

  IF NOT v_should_send THEN
    RETURN NEW;
  END IF;

  -- Check if user has active devices
  IF NOT EXISTS (
    SELECT 1 FROM public.user_devices
    WHERE user_id = NEW.user_id
      AND active = true
      AND push_token IS NOT NULL
  ) THEN
    RETURN NEW;
  END IF;

  -- Queue push notification
  INSERT INTO public.push_notification_queue (
    notification_id,
    user_id,
    title,
    body,
    data
  ) VALUES (
    NEW.id,
    NEW.user_id,
    NEW.title,
    NEW.message,
    jsonb_build_object(
      'notification_id', NEW.id::text,
      'event_type', NEW.event_type,
      'action_url', NEW.action_url
    ) || COALESCE(NEW.data, '{}'::jsonb)
  );

  RETURN NEW;
END;
$$;

-- Use queue-based approach (more reliable than direct pg_net)
-- Comment out the direct pg_net trigger and use queue instead
DROP TRIGGER IF EXISTS on_notification_created_queue_push ON public.notifications;

CREATE TRIGGER on_notification_created_queue_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.read_at IS NULL)
  EXECUTE FUNCTION public.queue_push_notification();

COMMENT ON TRIGGER on_notification_created_queue_push ON public.notifications IS
'Queues push notifications for processing by Edge Function';

