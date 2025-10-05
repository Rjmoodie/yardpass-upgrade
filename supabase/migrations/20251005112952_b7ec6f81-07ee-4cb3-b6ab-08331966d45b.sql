-- Allow authenticated users to insert their own event impressions
CREATE POLICY "Users can insert their own event impressions"
ON public.event_impressions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Also allow anonymous session tracking (for non-logged-in users)
CREATE POLICY "Allow anonymous impression tracking"
ON public.event_impressions
FOR INSERT
TO anon
WITH CHECK (user_id IS NULL AND session_id IS NOT NULL);