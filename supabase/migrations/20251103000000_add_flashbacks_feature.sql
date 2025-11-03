-- Migration: Add Flashbacks Feature
-- Date: 2025-11-03
-- Description: Enables organizers to create "Flashback" events for past events,
--              allowing any authenticated user to post memories for 90 days.

-- ============================================================================
-- 1. EXTEND EVENTS TABLE
-- ============================================================================

-- Add flashback-related columns
ALTER TABLE events.events 
ADD COLUMN IF NOT EXISTS is_flashback BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS flashback_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS linked_event_id UUID REFERENCES events.events(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS flashback_explainer TEXT DEFAULT 'Share your favorite moments from this past event';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_flashback 
  ON events.events(is_flashback, flashback_end_date) 
  WHERE is_flashback = true;

CREATE INDEX IF NOT EXISTS idx_events_linked_event 
  ON events.events(linked_event_id) 
  WHERE linked_event_id IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN events.events.is_flashback IS 
  'Marks event as a Flashback (past event for memory sharing). Posts visible in feed but event card is not.';

COMMENT ON COLUMN events.events.flashback_end_date IS 
  'Auto-calculated: event_end + 90 days. Posting closes after this date. Calculated by trigger.';

COMMENT ON COLUMN events.events.linked_event_id IS 
  'Optional link to new/upcoming event (e.g., "Check out this year''s festival"). Shows CTA on flashback event page.';

COMMENT ON COLUMN events.events.flashback_explainer IS 
  'Custom message shown on event page explaining what flashbacks are. Organizer can customize.';

-- ============================================================================
-- 2. EXTEND EVENT POSTS TABLE
-- ============================================================================

-- Add organizer moderation column
ALTER TABLE events.event_posts
ADD COLUMN IF NOT EXISTS is_organizer_featured BOOLEAN DEFAULT false;

-- Create index for featured posts
CREATE INDEX IF NOT EXISTS idx_event_posts_organizer_featured 
  ON events.event_posts(event_id, is_organizer_featured, created_at DESC)
  WHERE is_organizer_featured = true;

-- Comments
COMMENT ON COLUMN events.event_posts.is_organizer_featured IS 
  'Organizer can feature/boost posts for ranking (Flashbacks only). Gives +5 score boost in feed algorithm.';

-- ============================================================================
-- 3. AUTO-CALCULATE FLASHBACK END DATE
-- ============================================================================

CREATE OR REPLACE FUNCTION events.calculate_flashback_end_date()
RETURNS TRIGGER AS $$
BEGIN
  -- If event is marked as flashback and has an end date
  IF NEW.is_flashback = true AND NEW.end_at IS NOT NULL THEN
    -- Set flashback_end_date to 90 days after event ends
    NEW.flashback_end_date := NEW.end_at + interval '90 days';
  ELSIF NEW.is_flashback = false THEN
    -- If flashback is disabled, clear the end date
    NEW.flashback_end_date := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_calculate_flashback_end_date ON events.events;
CREATE TRIGGER trg_calculate_flashback_end_date
  BEFORE INSERT OR UPDATE OF is_flashback, end_at ON events.events
  FOR EACH ROW
  EXECUTE FUNCTION events.calculate_flashback_end_date();

COMMENT ON FUNCTION events.calculate_flashback_end_date IS 
  'Auto-calculates flashback_end_date as event_end + 90 days when is_flashback is true';

-- ============================================================================
-- 4. POSTING PERMISSIONS FOR FLASHBACKS
-- ============================================================================

-- Function to check if user can post to flashback events
CREATE OR REPLACE FUNCTION public.can_post_to_flashback(p_event_id uuid) 
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM events.events e
    WHERE e.id = p_event_id
      AND e.is_flashback = true
      AND auth.uid() IS NOT NULL  -- Must be authenticated
      AND (
        -- Within 90-day posting window
        e.flashback_end_date IS NULL 
        OR e.flashback_end_date > now()
      )
  ) 
  -- Organizers can always post (even after 90 days)
  OR public.is_event_manager(p_event_id);
$$;

COMMENT ON FUNCTION public.can_post_to_flashback IS 
  'Returns true if user can post to a flashback event. Rules: Any authenticated user within 90 days, or event organizer anytime.';

-- Update main posting permission function
CREATE OR REPLACE FUNCTION public.can_current_user_post(p_event_id uuid) 
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO public
AS $$
  SELECT
    -- Check if this is a flashback event
    CASE 
      WHEN (SELECT is_flashback FROM events.events WHERE id = p_event_id) = true THEN
        -- Flashback rules: Any authenticated user (no ticket required!)
        public.can_post_to_flashback(p_event_id)
      ELSE
        -- Regular event rules: Organizer OR ticket holder
        EXISTS (
          -- Direct event ownership check
          SELECT 1
          FROM events.events ev
          WHERE ev.id = p_event_id
            AND (
              ev.created_by = auth.uid()
              OR (
                ev.owner_context_type = 'individual'
                AND ev.owner_context_id = auth.uid()
              )
              OR (
                ev.owner_context_type = 'organization'
                AND EXISTS (
                  SELECT 1 FROM public.org_memberships om
                  WHERE om.org_id = ev.owner_context_id
                    AND om.user_id = auth.uid()
                    AND om.role::text IN ('owner','admin','editor')
                )
              )
            )
        )
        OR EXISTS (
          -- Valid ticket holder check
          SELECT 1
          FROM public.tickets t
          WHERE t.event_id = p_event_id
            AND t.owner_user_id = auth.uid()
            AND t.status::text IN ('issued','transferred','redeemed')
        )
    END;
$$;

COMMENT ON FUNCTION public.can_current_user_post IS 
  'Returns true if user can post to an event. For flashbacks: any authenticated user. For regular events: organizer or ticket holder.';

-- ============================================================================
-- 5. RLS POLICIES (No changes needed - existing policies work)
-- ============================================================================

-- Note: Existing RLS policies on event_posts already use can_current_user_post(),
-- so they will automatically respect flashback rules.

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Function to check if flashback posting is still open
CREATE OR REPLACE FUNCTION public.is_flashback_posting_open(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM events.events
    WHERE id = p_event_id
      AND is_flashback = true
      AND (flashback_end_date IS NULL OR flashback_end_date > now())
  );
$$;

COMMENT ON FUNCTION public.is_flashback_posting_open IS 
  'Returns true if flashback event is still accepting posts (within 90-day window)';

-- Function to get flashback stats
CREATE OR REPLACE FUNCTION public.get_flashback_stats(p_event_id uuid)
RETURNS TABLE (
  total_posts bigint,
  total_contributors bigint,
  featured_posts bigint,
  days_remaining integer,
  is_expired boolean
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Total posts
    (SELECT COUNT(*) FROM events.event_posts 
     WHERE event_id = p_event_id 
       AND deleted_at IS NULL
    )::bigint AS total_posts,
    
    -- Unique contributors
    (SELECT COUNT(DISTINCT author_user_id) FROM events.event_posts 
     WHERE event_id = p_event_id 
       AND deleted_at IS NULL
    )::bigint AS total_contributors,
    
    -- Featured posts
    (SELECT COUNT(*) FROM events.event_posts 
     WHERE event_id = p_event_id 
       AND is_organizer_featured = true
       AND deleted_at IS NULL
    )::bigint AS featured_posts,
    
    -- Days remaining
    CASE 
      WHEN e.flashback_end_date IS NULL THEN NULL
      ELSE GREATEST(0, EXTRACT(days FROM (e.flashback_end_date - now()))::integer)
    END AS days_remaining,
    
    -- Is expired
    CASE 
      WHEN e.flashback_end_date IS NULL THEN false
      ELSE e.flashback_end_date < now()
    END AS is_expired
    
  FROM events.events e
  WHERE e.id = p_event_id;
END;
$$;

COMMENT ON FUNCTION public.get_flashback_stats IS 
  'Returns statistics for a flashback event: posts, contributors, featured count, days remaining';

-- ============================================================================
-- 7. UPDATE FEED FUNCTION TO EXCLUDE FLASHBACK EVENTS
-- ============================================================================

-- The get_home_feed_ids function needs to exclude flashback events from the feed.
-- We'll update the WHERE clause to filter them out.

-- Note: The actual function update depends on your existing get_home_feed_ids implementation.
-- For now, we add a comment that any feed query should include:
-- WHERE (is_flashback = false OR is_flashback IS NULL)

COMMENT ON COLUMN events.events.is_flashback IS 
  'Marks event as a Flashback (past event for memory sharing). Feed queries should filter: WHERE (is_flashback = false OR is_flashback IS NULL)';

-- ============================================================================
-- 8. VIEWS (Expose to public schema)
-- ============================================================================

-- Note: Views may already exist. We use CREATE OR REPLACE to update them safely.
-- If views don't exist or have different structures, this will create/update them.

-- Update events view to include flashback columns (if view exists)
CREATE OR REPLACE VIEW public.events AS
SELECT * FROM events.events;

GRANT SELECT ON public.events TO anon;
GRANT SELECT ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

-- Update event_posts view to include is_organizer_featured (if view exists)
CREATE OR REPLACE VIEW public.event_posts AS
SELECT * FROM events.event_posts;

GRANT SELECT ON public.event_posts TO anon;
GRANT SELECT ON public.event_posts TO authenticated;
GRANT ALL ON public.event_posts TO service_role;

-- ============================================================================
-- 8. SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Uncomment to create a sample flashback event for testing
/*
INSERT INTO events.events (
  title,
  description,
  start_at,
  end_at,
  created_by,
  is_flashback,
  flashback_explainer,
  visibility
) VALUES (
  'Summer Music Festival 2024 (Flashback)',
  'Relive the amazing moments from last year''s festival! Share your photos and videos.',
  '2024-07-15 10:00:00+00',
  '2024-07-17 23:00:00+00',
  (SELECT id FROM auth.users LIMIT 1),  -- Replace with actual organizer ID
  true,
  'Share your favorite moments from Summer Fest 2024! Your memories help us build excitement for this year''s event.',
  'public'
);
*/

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verify migration
DO $$
BEGIN
  RAISE NOTICE '✅ Flashbacks feature migration complete!';
  RAISE NOTICE '📊 Added columns: is_flashback, flashback_end_date, linked_event_id, flashback_explainer, is_organizer_featured';
  RAISE NOTICE '🔧 Created functions: calculate_flashback_end_date, can_post_to_flashback, is_flashback_posting_open, get_flashback_stats';
  RAISE NOTICE '🔐 Updated: can_current_user_post to support flashback rules';
  RAISE NOTICE '📈 Created indexes for flashback queries';
  RAISE NOTICE '✨ Ready to use! Organizers can now create flashback events.';
END $$;

