-- Fix analytics_events RLS policies to allow general analytics tracking
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "insert_own_analytics" ON public.analytics_events;
DROP POLICY IF EXISTS "read_own_analytics" ON public.analytics_events;
DROP POLICY IF EXISTS "read_event_analytics" ON public.analytics_events;

-- Create more permissive policies for analytics tracking
CREATE POLICY "allow_analytics_insert" 
ON public.analytics_events 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "allow_analytics_read_own" 
ON public.analytics_events 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR auth.role() = 'service_role'::text
  OR (event_id IS NOT NULL AND is_event_manager(event_id))
);

-- Allow system updates for analytics processing
CREATE POLICY "allow_analytics_update_system" 
ON public.analytics_events 
FOR UPDATE 
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);