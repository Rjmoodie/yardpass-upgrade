-- ============================================================================
-- Migration: Create Notification Preferences
-- Purpose: Allow users to control which notifications trigger push notifications
-- Author: AI Assistant
-- Date: 2025-01-14
-- Status: ⚠️ PENDING DEPLOYMENT - Deploy via Supabase Dashboard SQL Editor
-- Dependencies: None (standalone migration)
-- ============================================================================

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_messages BOOLEAN DEFAULT true,
  push_tickets BOOLEAN DEFAULT true,
  push_social BOOLEAN DEFAULT true,  -- Likes, comments, follows
  push_marketing BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own preferences"
  ON public.notification_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
  ON public.notification_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
  ON public.notification_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Function to get user's notification preferences (with defaults)
CREATE OR REPLACE FUNCTION public.get_notification_preferences(p_user_id UUID)
RETURNS TABLE(
  push_messages BOOLEAN,
  push_tickets BOOLEAN,
  push_social BOOLEAN,
  push_marketing BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(np.push_messages, true) as push_messages,
    COALESCE(np.push_tickets, true) as push_tickets,
    COALESCE(np.push_social, true) as push_social,
    COALESCE(np.push_marketing, false) as push_marketing
  FROM public.notification_preferences np
  WHERE np.user_id = p_user_id
  
  UNION ALL
  
  -- Return defaults if no preferences exist
  SELECT true, true, true, false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notification_preferences WHERE user_id = p_user_id
  )
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_notification_preferences IS 'Returns user notification preferences with sensible defaults';

GRANT EXECUTE ON FUNCTION public.get_notification_preferences(UUID) TO authenticated, anon;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id 
  ON public.notification_preferences(user_id);

