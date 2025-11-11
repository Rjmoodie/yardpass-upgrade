-- Migration: Add checkout session tracking for purchase intent signals
-- This enables tracking when users start checkout (high intent signal, weight: 4.0)

-- ==========================================
-- PART 1: Drop existing view (if any)
-- ==========================================

-- Drop view if it exists (some installations may have a view from earlier setup)
DROP VIEW IF EXISTS public.checkout_sessions CASCADE;

-- ==========================================
-- PART 2: Checkout Sessions Table
-- ==========================================

CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User identification (either user_id or session_id for guests)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT, -- For anonymous/guest users
  
  -- Checkout details
  event_id UUID NOT NULL REFERENCES events.events(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ, -- NULL if abandoned, set when order completes
  
  -- Purchase details
  total_cents INT NOT NULL,
  total_quantity INT NOT NULL,
  stripe_session_id TEXT, -- Link to Stripe checkout session
  
  -- Deduplication (one checkout per user/event/hour)
  hour_bucket TIMESTAMPTZ DEFAULT date_trunc('hour', now()),
  
  -- Metadata
  tier_ids UUID[], -- Array of ticket tier IDs
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- PART 3: Indexes
-- ==========================================

-- Dedup: Prevent spam tracking (one checkout per user/event/hour)
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkout_sessions_dedup
  ON public.checkout_sessions(user_id, event_id, hour_bucket)
  WHERE user_id IS NOT NULL;

-- Fast lookup by user for feed ranking
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_user_recent
  ON public.checkout_sessions(user_id, started_at DESC)
  WHERE user_id IS NOT NULL AND completed_at IS NULL;

-- Fast lookup by event
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_event
  ON public.checkout_sessions(event_id, started_at DESC);

-- Fast lookup by Stripe session (for webhook completion)
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_stripe
  ON public.checkout_sessions(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- Fast lookup for abandoned checkouts (analytics)
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_abandoned
  ON public.checkout_sessions(event_id, started_at DESC)
  WHERE completed_at IS NULL;

-- ==========================================
-- PART 4: Row Level Security (RLS)
-- ==========================================

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own checkout sessions
DROP POLICY IF EXISTS "Users can insert their own checkout sessions" ON public.checkout_sessions;
CREATE POLICY "Users can insert their own checkout sessions"
  ON public.checkout_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own checkout sessions
DROP POLICY IF EXISTS "Users can view their own checkout sessions" ON public.checkout_sessions;
CREATE POLICY "Users can view their own checkout sessions"
  ON public.checkout_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can update checkout sessions (for webhook completion)
DROP POLICY IF EXISTS "Service role can update checkout sessions" ON public.checkout_sessions;
CREATE POLICY "Service role can update checkout sessions"
  ON public.checkout_sessions FOR UPDATE
  USING (true);

-- ==========================================
-- PART 5: Helper Function
-- ==========================================

-- Function to mark checkout as completed (called by webhook)
CREATE OR REPLACE FUNCTION public.complete_checkout_session(
  p_stripe_session_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.checkout_sessions
  SET completed_at = now()
  WHERE stripe_session_id = p_stripe_session_id
    AND completed_at IS NULL;
  
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_checkout_session TO service_role;

-- ==========================================
-- PART 6: Comments
-- ==========================================

COMMENT ON TABLE public.checkout_sessions IS 
  'Tracks when users start checkout (strong purchase intent signal, weight: 4.0). Abandoned checkouts (completed_at IS NULL) indicate high intent for feed ranking.';

COMMENT ON COLUMN public.checkout_sessions.completed_at IS 
  'NULL = abandoned checkout (high intent for feed ranking). Set when order completes (via webhook).';

COMMENT ON COLUMN public.checkout_sessions.hour_bucket IS 
  'Used for deduplication - only track one checkout per user/event/hour to prevent spam.';

COMMENT ON FUNCTION public.complete_checkout_session IS 
  'Called by Stripe webhook to mark checkout as completed. Returns true if checkout was found and updated.';

-- Success message
SELECT 'Checkout session tracking enabled! 🛒' AS status;

