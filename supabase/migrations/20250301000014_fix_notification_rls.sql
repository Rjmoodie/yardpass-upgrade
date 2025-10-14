-- Fix notification RLS for follow triggers
-- The issue is that triggers run in the context of the user who initiated the action,
-- but the notification is being created for a different user (the one being followed)

-- First, let's create a function that can bypass RLS for system notifications
CREATE OR REPLACE FUNCTION public.create_follow_notification(
  target_user_id UUID,
  follower_user_id UUID,
  follower_name TEXT
)
RETURNS VOID AS $$
BEGIN
  -- Insert notification for the user being followed
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    event_type,
    data,
    created_at
  ) VALUES (
    target_user_id,
    'info',
    'New Follow Request',
    follower_name || ' wants to follow you',
    'user_follow',
    jsonb_build_object(
      'follower_user_id', follower_user_id,
      'follower_name', follower_name,
      'follow_id', (SELECT id FROM public.follows WHERE follower_user_id = create_follow_notification.follower_user_id AND target_id = create_follow_notification.target_user_id ORDER BY created_at DESC LIMIT 1)
    ),
    NOW()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the follow operation
    RAISE WARNING 'Failed to create follow notification: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_follow_notification TO authenticated;

-- Update the trigger function to use the new helper function
CREATE OR REPLACE FUNCTION public.notify_user_follow()
RETURNS TRIGGER AS $$
DECLARE
  follower_name TEXT;
BEGIN
  -- Only notify for user-to-user follows
  IF NEW.target_type = 'user' AND NEW.target_id != NEW.follower_user_id THEN
    -- Get the follower's display name
    SELECT display_name INTO follower_name
    FROM public.user_profiles
    WHERE user_id = NEW.follower_user_id;
    
    -- Use the helper function to create the notification
    PERFORM public.create_follow_notification(
      NEW.target_id,
      NEW.follower_user_id,
      COALESCE(follower_name, 'Someone')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger is already created, so we don't need to recreate it
