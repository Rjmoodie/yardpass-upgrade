-- Test messaging system tables and data
-- This script verifies that the messaging system is working correctly

-- Check if tables exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('direct_conversations', 'conversation_participants', 'direct_messages')
ORDER BY table_name;

-- Check if we have any conversations
SELECT COUNT(*) as conversation_count FROM public.direct_conversations;

-- Check if we have any participants
SELECT COUNT(*) as participant_count FROM public.conversation_participants;

-- Check if we have any messages
SELECT COUNT(*) as message_count FROM public.direct_messages;

-- Check RLS policies on direct_conversations
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'direct_conversations';

-- Test a simple query to see if we can access conversations
SELECT 
  dc.id,
  dc.subject,
  dc.request_status,
  dc.created_at
FROM public.direct_conversations dc
LIMIT 5;
