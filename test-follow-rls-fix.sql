-- Test script to verify follow RLS policies work correctly
-- This script tests the follow functionality and notification creation

-- Test 1: Check if we can insert a follow record
-- (This should work if RLS policies are correct)

-- Test 2: Check if notifications are created properly
-- (This should work if the SECURITY DEFINER function is set up correctly)

-- First, let's see what users exist
SELECT user_id, display_name 
FROM public.user_profiles 
LIMIT 5;

-- Check if follows table has the right structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'follows' 
ORDER BY ordinal_position;

-- Check current RLS policies on follows table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'follows';

-- Check if the notification function exists and has proper permissions
SELECT routine_name, routine_type, security_type
FROM information_schema.routines 
WHERE routine_name = 'create_follow_notification';
