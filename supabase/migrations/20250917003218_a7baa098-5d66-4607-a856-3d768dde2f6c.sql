-- Fix RLS policy for analytics_events to allow authenticated users to insert their own events
DROP POLICY IF EXISTS "insert_own_analytics" ON analytics_events;

CREATE POLICY "insert_own_analytics" 
ON analytics_events 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);