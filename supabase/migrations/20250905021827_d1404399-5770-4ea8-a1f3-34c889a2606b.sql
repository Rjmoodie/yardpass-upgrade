-- Drop the existing foreign key that points to auth.users
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_created_by_fkey;

-- Create the correct foreign key pointing to user_profiles.user_id
ALTER TABLE public.events 
ADD CONSTRAINT events_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES public.user_profiles(user_id) 
ON DELETE CASCADE;

-- Create foreign key for organization relationship
ALTER TABLE public.events 
ADD CONSTRAINT events_owner_context_id_fkey 
FOREIGN KEY (owner_context_id) 
REFERENCES public.organizations(id) 
ON DELETE CASCADE;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';