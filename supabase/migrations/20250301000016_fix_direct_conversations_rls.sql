-- Fix RLS policies for direct_conversations table
-- The current policy is too restrictive and doesn't allow users to create conversations

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "conversation_insert" ON public.direct_conversations;

-- Create a more permissive policy that allows authenticated users to create conversations
CREATE POLICY "conversation_insert" ON public.direct_conversations
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- Also ensure conversation_participants has proper insert policy
DROP POLICY IF EXISTS "conversation_participant_insert" ON public.conversation_participants;

CREATE POLICY "conversation_participant_insert" ON public.conversation_participants
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
