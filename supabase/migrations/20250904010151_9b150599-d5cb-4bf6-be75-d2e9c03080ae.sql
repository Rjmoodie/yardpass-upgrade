-- Add missing updated_at column to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();