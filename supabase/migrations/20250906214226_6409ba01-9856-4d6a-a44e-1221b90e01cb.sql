-- Create unified analytics_events table
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NULL,
  event_type text NOT NULL,
  event_id uuid NULL,
  ticket_id uuid NULL,
  source text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'
);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Insert policy: authenticated users may insert rows where user_id = auth.uid()
CREATE POLICY "insert_own_analytics"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK ( user_id = auth.uid() );

-- Read policy for users to see their own analytics
CREATE POLICY "read_own_analytics"
ON public.analytics_events
FOR SELECT
TO authenticated
USING ( user_id = auth.uid() );

-- Read policy for event managers to see event analytics
CREATE POLICY "read_event_analytics"
ON public.analytics_events
FOR SELECT
TO authenticated
USING ( 
  event_id IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = analytics_events.event_id::uuid 
    AND is_event_manager(e.id)
  )
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS analytics_events_user_id_idx ON public.analytics_events (user_id);
CREATE INDEX IF NOT EXISTS analytics_events_event_type_idx ON public.analytics_events (event_type);
CREATE INDEX IF NOT EXISTS analytics_events_event_id_idx ON public.analytics_events (event_id);
CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON public.analytics_events (created_at DESC);