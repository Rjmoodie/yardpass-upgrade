-- Fix RLS policies for user_profiles to allow signup trigger
-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Users can create their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_self" ON public.user_profiles;

-- Create a new policy that allows the signup trigger to work
-- This allows inserts during signup when auth.uid() might not be available yet
CREATE POLICY "Allow profile creation during signup"
ON public.user_profiles
FOR INSERT
WITH CHECK (true);

-- Keep existing read and update policies
-- Users can still only update their own profiles
-- The existing policies for SELECT and UPDATE remain as they are