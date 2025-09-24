-- Add sponsor mode flag to user profiles
ALTER TABLE public.user_profiles 
ADD COLUMN sponsor_mode_enabled boolean NOT NULL DEFAULT false;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_sponsor_mode ON public.user_profiles(sponsor_mode_enabled);

-- Add RLS policy for users to update their own sponsor mode
CREATE POLICY "Users can update their own sponsor mode" 
ON public.user_profiles 
FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);