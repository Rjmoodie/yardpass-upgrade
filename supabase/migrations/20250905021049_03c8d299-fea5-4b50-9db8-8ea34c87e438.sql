-- Add foreign key constraint from events.created_by to user_profiles.user_id
-- This will fix the PGRST200 error when querying events with user profile joins

ALTER TABLE public.events 
ADD CONSTRAINT events_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES public.user_profiles(user_id) 
ON DELETE CASCADE;