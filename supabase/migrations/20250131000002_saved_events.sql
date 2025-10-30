-- Create saved_events table for users to bookmark events
CREATE TABLE IF NOT EXISTS public.saved_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events.events(id) ON DELETE CASCADE,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Ensure a user can only save an event once
  UNIQUE(user_id, event_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_events_user ON public.saved_events(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_events_event ON public.saved_events(event_id);
CREATE INDEX IF NOT EXISTS idx_saved_events_saved_at ON public.saved_events(saved_at DESC);

-- RLS Policies
ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own saved events
CREATE POLICY "Users can view own saved events"
  ON public.saved_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can save events
CREATE POLICY "Users can save events"
  ON public.saved_events
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own saved events
CREATE POLICY "Users can delete own saved events"
  ON public.saved_events
  FOR DELETE
  USING (auth.uid() = user_id);

-- Helper RPC to toggle saved status
CREATE OR REPLACE FUNCTION public.toggle_saved_event(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_exists BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Check if already saved
  SELECT EXISTS(
    SELECT 1 FROM public.saved_events 
    WHERE user_id = v_user_id AND event_id = p_event_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Remove
    DELETE FROM public.saved_events 
    WHERE user_id = v_user_id AND event_id = p_event_id;
    RETURN FALSE; -- Now unsaved
  ELSE
    -- Add
    INSERT INTO public.saved_events (user_id, event_id) 
    VALUES (v_user_id, p_event_id);
    RETURN TRUE; -- Now saved
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_saved_event TO authenticated, anon;

-- Verify
SELECT 'saved_events table created successfully' AS status;

