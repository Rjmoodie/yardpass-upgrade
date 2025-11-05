-- =====================================================
-- TAG-BASED RECOMMENDATIONS FOR FEED ALGORITHM
-- Date: 2025-01-03
-- Description: Integrate tags into recommendation system with
--              user preference tracking and collaborative filtering
-- =====================================================

-- =====================================================
-- PART 1: USER TAG PREFERENCES TRACKING
-- =====================================================

-- Create table to track which tags users prefer
CREATE TABLE IF NOT EXISTS public.user_tag_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag text NOT NULL,
  weight numeric NOT NULL DEFAULT 1.0,
  interaction_count integer NOT NULL DEFAULT 1,
  last_interacted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_user_tag_prefs_user_id ON public.user_tag_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tag_prefs_tag ON public.user_tag_preferences(tag);
CREATE INDEX IF NOT EXISTS idx_user_tag_prefs_weight ON public.user_tag_preferences(user_id, weight DESC);

COMMENT ON TABLE public.user_tag_preferences IS 'Tracks user preferences for event tags based on their behavior';
COMMENT ON COLUMN public.user_tag_preferences.weight IS 'Preference strength: higher = stronger interest (built from interactions)';
COMMENT ON COLUMN public.user_tag_preferences.interaction_count IS 'Total number of interactions with events having this tag';

-- =====================================================
-- PART 2: AUTO-LEARN TAG PREFERENCES (REFACTORED)
-- =====================================================

-- Generic helper: update prefs directly from a tags array
CREATE OR REPLACE FUNCTION public.update_user_tag_preferences_from_tags(
  p_user_id uuid,
  p_tags text[],
  p_weight_delta numeric DEFAULT 1.0
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  tag text;
BEGIN
  -- No tags? Nothing to do.
  IF p_tags IS NULL OR array_length(p_tags, 1) IS NULL THEN
    RETURN;
  END IF;

  FOREACH tag IN ARRAY p_tags
  LOOP
    INSERT INTO public.user_tag_preferences (
      user_id, tag, weight, interaction_count, last_interacted_at
    )
    VALUES (p_user_id, tag, p_weight_delta, 1, now())
    ON CONFLICT (user_id, tag) DO UPDATE SET
      weight            = public.user_tag_preferences.weight + p_weight_delta,
      interaction_count = public.user_tag_preferences.interaction_count + 1,
      last_interacted_at = now();
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.update_user_tag_preferences_from_tags IS
  'Updates user tag preferences given a set of tags directly (helper used by event- and post-based learning).';

-- Refactor existing event-based helper to use the tags helper
CREATE OR REPLACE FUNCTION public.update_user_tag_preferences(
  p_user_id uuid,
  p_event_id uuid,
  p_weight_delta numeric DEFAULT 1.0
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  event_tags text[];
BEGIN
  -- Get tags from the event
  SELECT tags INTO event_tags
  FROM events.events
  WHERE id = p_event_id;

  -- Delegate to the tags-based helper
  PERFORM public.update_user_tag_preferences_from_tags(
    p_user_id,
    event_tags,
    p_weight_delta
  );
END;
$$;

COMMENT ON FUNCTION public.update_user_tag_preferences IS
  'Updates user tag preferences based on tags of a specific event.';

-- =====================================================
-- PART 3: TRIGGERS FOR AUTO-LEARNING
-- =====================================================

-- Trigger when user buys a ticket (strongest signal)
CREATE OR REPLACE FUNCTION public.learn_tags_from_ticket_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Weight: 3.0 for ticket purchase (strongest signal)
  PERFORM public.update_user_tag_preferences(NEW.owner_user_id, NEW.event_id, 3.0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_learn_tags_from_ticket ON ticketing.tickets;
CREATE TRIGGER trg_learn_tags_from_ticket
  AFTER INSERT ON ticketing.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.learn_tags_from_ticket_purchase();

-- Trigger when user follows an event (strong signal)
CREATE OR REPLACE FUNCTION public.learn_tags_from_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only for event follows
  IF NEW.target_type = 'event' THEN
    -- Weight: 2.0 for following event
    PERFORM public.update_user_tag_preferences(NEW.follower_user_id, NEW.target_id, 2.0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_learn_tags_from_follow ON users.follows;
CREATE TRIGGER trg_learn_tags_from_follow
  AFTER INSERT ON users.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.learn_tags_from_follow();

-- Trigger when user views event details (medium signal)
CREATE OR REPLACE FUNCTION public.learn_tags_from_impression()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only if dwell time > 5 seconds (meaningful engagement)
  IF NEW.dwell_ms > 5000 THEN
    -- Weight: 0.5 for viewing (lighter signal)
    PERFORM public.update_user_tag_preferences(NEW.user_id, NEW.event_id, 0.5);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_learn_tags_from_impression ON events.event_impressions;
CREATE TRIGGER trg_learn_tags_from_impression
  AFTER INSERT ON events.event_impressions
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION public.learn_tags_from_impression();

-- =====================================================
-- PART 4: FEED ALGORITHM INTEGRATION
-- =====================================================

-- Note: The feed algorithm is updated in a separate migration (20250103_fix_feed_function.sql)
-- to maintain proper function signatures for Edge Function compatibility.
-- This migration focuses on the auto-learning infrastructure.

-- =====================================================
-- PART 5: TAG DECAY (PREVENT STALE PREFERENCES)
-- =====================================================

-- Function to decay old tag preferences (run weekly)
CREATE OR REPLACE FUNCTION public.decay_tag_preferences()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Reduce weight for tags not interacted with in 30+ days
  UPDATE public.user_tag_preferences
  SET weight = GREATEST(0.1, weight * 0.9)
  WHERE last_interacted_at < now() - interval '30 days'
    AND weight > 0.1;
  
  -- Remove very weak preferences (weight < 0.1)
  DELETE FROM public.user_tag_preferences
  WHERE weight < 0.1;
END;
$$;

COMMENT ON FUNCTION public.decay_tag_preferences IS 'Decays old tag preferences to keep recommendations fresh';

-- =====================================================
-- PART 5.5: LEARN FROM POST ENGAGEMENT (FIXED)
-- =====================================================

-- When a user likes a post, learn from the event's tags (+0.3 weight)
CREATE OR REPLACE FUNCTION public.learn_tags_from_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  -- Only process 'like' reactions
  IF NEW.kind != 'like' THEN
    RETURN NEW;
  END IF;

  -- Find the parent event for this post
  SELECT p.event_id INTO v_event_id
  FROM events.event_posts p
  WHERE p.id = NEW.post_id;

  -- Safety: if for some reason the post has no event, bail out
  IF v_event_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Weight: +0.3 for likes (lighter than comments, much lighter than tickets)
  PERFORM public.update_user_tag_preferences(
    NEW.user_id,
    v_event_id,
    0.3
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.learn_tags_from_post_like IS
  'Learns user tag preferences from post likes (+0.3 weight based on the parent event).';

-- Make migration re-runnable
DROP TRIGGER IF EXISTS trg_learn_tags_from_post_like ON events.event_reactions;

CREATE TRIGGER trg_learn_tags_from_post_like
AFTER INSERT ON events.event_reactions
FOR EACH ROW
WHEN (NEW.kind = 'like')
EXECUTE FUNCTION public.learn_tags_from_post_like();

-- When a user comments on a post, learn from the event's tags (+0.4 weight)
CREATE OR REPLACE FUNCTION public.learn_tags_from_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  -- Find the parent event for this post
  SELECT p.event_id INTO v_event_id
  FROM events.event_posts p
  WHERE p.id = NEW.post_id;

  IF v_event_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Weight: +0.4 for comments (stronger signal than likes)
  PERFORM public.update_user_tag_preferences(
    NEW.author_user_id,
    v_event_id,
    0.4
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.learn_tags_from_post_comment IS
  'Learns user tag preferences from post comments (+0.4 weight based on the parent event).';

-- Make migration re-runnable
DROP TRIGGER IF EXISTS trg_learn_tags_from_post_comment ON events.event_comments;

CREATE TRIGGER trg_learn_tags_from_post_comment
AFTER INSERT ON events.event_comments
FOR EACH ROW
EXECUTE FUNCTION public.learn_tags_from_post_comment();

-- =====================================================
-- PART 6: COLLABORATIVE FILTERING HELPERS
-- =====================================================

-- Find users with similar tag preferences
CREATE OR REPLACE FUNCTION public.find_similar_users(
  p_user_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  similar_user_id uuid,
  similarity_score numeric,
  shared_tags integer
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    utp2.user_id AS similar_user_id,
    -- Jaccard similarity on tags
    COUNT(*)::numeric / (
      (SELECT COUNT(DISTINCT tag) FROM public.user_tag_preferences WHERE user_id = p_user_id) +
      (SELECT COUNT(DISTINCT tag) FROM public.user_tag_preferences WHERE user_id = utp2.user_id) -
      COUNT(*)
    ) AS similarity_score,
    COUNT(*)::integer AS shared_tags
  FROM public.user_tag_preferences utp1
  JOIN public.user_tag_preferences utp2 ON utp1.tag = utp2.tag
  WHERE utp1.user_id = p_user_id
    AND utp2.user_id != p_user_id
  GROUP BY utp2.user_id
  HAVING COUNT(*) >= 3  -- At least 3 shared tags
  ORDER BY similarity_score DESC
  LIMIT p_limit;
END;
$$;

-- Get recommended events based on similar users (null-safe)
CREATE OR REPLACE FUNCTION public.get_collaborative_recommendations(
  p_user_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  event_id uuid,
  recommendation_score numeric,
  similar_users_count integer
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- If no user, no collaborative recommendations
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH similar_users AS (
    SELECT similar_user_id, similarity_score
    FROM public.find_similar_users(p_user_id, 20)
  ),
  their_events AS (
    SELECT 
      t.event_id,
      COUNT(DISTINCT t.owner_user_id) AS user_count,
      AVG(su.similarity_score) AS avg_similarity
    FROM ticketing.tickets t
    JOIN similar_users su ON su.similar_user_id = t.owner_user_id
    WHERE t.event_id NOT IN (
      -- Exclude events user already has tickets for
      SELECT t2.event_id FROM ticketing.tickets t2 WHERE t2.owner_user_id = p_user_id
    )
    GROUP BY t.event_id
  )
  SELECT
    te.event_id,
    (te.user_count * te.avg_similarity) AS recommendation_score,
    te.user_count::integer AS similar_users_count
  FROM their_events te
  JOIN events.events e ON e.id = te.event_id
  WHERE e.start_at > now()
    AND e.visibility = 'public'
  ORDER BY recommendation_score DESC
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- PART 7: PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tag_preferences TO authenticated;
GRANT SELECT ON public.user_tag_preferences TO service_role;

GRANT EXECUTE ON FUNCTION public.update_user_tag_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_similar_users TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_collaborative_recommendations TO authenticated;
GRANT EXECUTE ON FUNCTION public.decay_tag_preferences TO service_role;

-- =====================================================
-- PART 8: INITIAL DATA POPULATION
-- =====================================================

-- Populate tag preferences from existing ticket purchases
INSERT INTO public.user_tag_preferences (user_id, tag, weight, interaction_count, last_interacted_at)
SELECT 
  t.owner_user_id,
  unnest(e.tags) AS tag,
  COUNT(*) * 3.0 AS weight,  -- 3.0 per ticket
  COUNT(*)::integer AS interaction_count,
  MAX(t.created_at) AS last_interacted_at
FROM ticketing.tickets t
JOIN events.events e ON e.id = t.event_id
WHERE e.tags IS NOT NULL 
  AND array_length(e.tags, 1) > 0
  AND t.status IN ('issued', 'transferred', 'redeemed')
GROUP BY t.owner_user_id, unnest(e.tags)
ON CONFLICT (user_id, tag) DO UPDATE SET
  weight = EXCLUDED.weight,
  interaction_count = EXCLUDED.interaction_count,
  last_interacted_at = EXCLUDED.last_interacted_at;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Summary comment
COMMENT ON TABLE public.user_tag_preferences IS 
  'Tag-based user preferences for personalized recommendations. Updated automatically via triggers on tickets, follows, and impressions. Weights: Ticket purchase=3.0, Follow=2.0, View>5s=0.5';

