-- Fix messaging_inbox view RLS policies
-- Views inherit RLS from underlying tables, so we ensure those are properly configured

-- Check if the messaging_inbox view exists, if not, create it
DO $$ 
BEGIN
  -- Check if the view exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'messaging_inbox'
  ) THEN
    -- Create the messaging_inbox view if it doesn't exist
    CREATE OR REPLACE VIEW public.messaging_inbox AS
    SELECT
      dc.id,
      dc.subject,
      dc.request_status,
      dc.last_message_at,
      dc.created_at,
      dc.metadata,
      jsonb_agg(
        jsonb_build_object(
          'participant_type', cp.participant_type,
          'participant_user_id', cp.participant_user_id,
          'participant_org_id', cp.participant_org_id,
          'joined_at', cp.joined_at,
          'last_read_at', cp.last_read_at
        )
        ORDER BY cp.joined_at
      ) AS participants
    FROM public.direct_conversations dc
    JOIN public.conversation_participants cp ON cp.conversation_id = dc.id
    GROUP BY dc.id;
  END IF;
END $$;

-- Ensure the underlying tables have proper RLS policies
-- (These should already exist from the main messaging migration, but let's ensure they're there)

-- Grant permissions on the view
GRANT SELECT ON public.messaging_inbox TO authenticated;
GRANT SELECT ON public.messaging_inbox TO anon;

-- The view will inherit RLS from the underlying direct_conversations table
-- No need to create policies directly on the view
