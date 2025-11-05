-- =====================================================
-- EVENT CREATOR ENHANCEMENTS - COMPREHENSIVE MIGRATION
-- Date: 2025-01-03
-- Description: Tags, scheduled publishing, fee options, add-ons, 
--              checkout questions, settings, and full search integration
-- =====================================================

-- =====================================================
-- PART 0: FIX EXISTING TRIGGER FUNCTIONS
-- =====================================================

-- Fix existing mark_event_completed function to use correct schema
CREATE OR REPLACE FUNCTION public.mark_event_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.end_at < now() AND OLD.completed_at IS NULL THEN
    NEW.completed_at := now();
    
    -- Check if this is the user's 25th completed event (for badge)
    IF (SELECT COUNT(*) FROM events.events 
        WHERE created_by = NEW.created_by 
        AND completed_at IS NOT NULL) >= 25 THEN
      -- Badge logic handled elsewhere
      NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- PART 1: CORE EVENT FEATURES
-- =====================================================

-- 1. Add tags column to events table (array of text)
ALTER TABLE events.events ADD COLUMN IF NOT EXISTS tags text[] DEFAULT ARRAY[]::text[];
COMMENT ON COLUMN events.events.tags IS 'Event tags for categorization and searchability';

-- 2. Add scheduled publish date
ALTER TABLE events.events ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;
COMMENT ON COLUMN events.events.scheduled_publish_at IS 'When to automatically publish the event (if set)';

-- 3. Add event settings as JSONB for flexible configuration
ALTER TABLE events.events ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;
COMMENT ON COLUMN events.events.settings IS 'Event settings like show_remaining_tickets, allow_waitlist, etc.';

-- =====================================================
-- PART 2: TICKET TIER ENHANCEMENTS
-- =====================================================

-- 4. Add fee absorption option to ticket tiers
ALTER TABLE ticketing.ticket_tiers ADD COLUMN IF NOT EXISTS fee_bearer text DEFAULT 'customer' CHECK (fee_bearer IN ('customer', 'organizer'));
COMMENT ON COLUMN ticketing.ticket_tiers.fee_bearer IS 'Who pays the fees: customer or organizer';

-- 5. Add visibility per tier (for advanced ticket settings)
ALTER TABLE ticketing.ticket_tiers ADD COLUMN IF NOT EXISTS tier_visibility text DEFAULT 'visible' CHECK (tier_visibility IN ('visible', 'hidden', 'secret'));
COMMENT ON COLUMN ticketing.ticket_tiers.tier_visibility IS 'Visibility of this tier: visible, hidden (direct link), secret (invite only)';

-- 6. Add linked tickets (prerequisite tickets)
ALTER TABLE ticketing.ticket_tiers ADD COLUMN IF NOT EXISTS requires_tier_id uuid REFERENCES ticketing.ticket_tiers(id);
COMMENT ON COLUMN ticketing.ticket_tiers.requires_tier_id IS 'Optional prerequisite tier that must be purchased first';

-- =====================================================
-- PART 3: ADD-ONS & MERCHANDISE
-- =====================================================

-- 7. Create event_addons table for merchandise and add-ons
CREATE TABLE IF NOT EXISTS ticketing.event_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  quantity integer, -- NULL = unlimited
  max_per_order integer DEFAULT 10,
  image_url text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'sold_out')),
  sort_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_addons_event_id ON ticketing.event_addons(event_id);
COMMENT ON TABLE ticketing.event_addons IS 'Merchandise and add-ons that can be purchased with event tickets';

-- =====================================================
-- PART 4: CUSTOM CHECKOUT QUESTIONS
-- =====================================================

-- 8. Create checkout_questions table for custom order form fields
CREATE TABLE IF NOT EXISTS ticketing.checkout_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events.events(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL CHECK (question_type IN ('text', 'textarea', 'select', 'checkbox', 'radio')),
  options jsonb, -- For select/radio/checkbox, store options as array
  required boolean DEFAULT false,
  applies_to text DEFAULT 'order' CHECK (applies_to IN ('order', 'ticket')), -- Per order or per ticket
  sort_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_questions_event_id ON ticketing.checkout_questions(event_id);
COMMENT ON TABLE ticketing.checkout_questions IS 'Custom questions asked during checkout';

-- 9. Create checkout_answers table to store responses
CREATE TABLE IF NOT EXISTS ticketing.checkout_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES ticketing.orders(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES ticketing.tickets(id) ON DELETE CASCADE, -- NULL if question is per-order
  question_id uuid NOT NULL REFERENCES ticketing.checkout_questions(id) ON DELETE CASCADE,
  answer_text text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_answers_order_id ON ticketing.checkout_answers(order_id);
CREATE INDEX IF NOT EXISTS idx_checkout_answers_question_id ON ticketing.checkout_answers(question_id);
COMMENT ON TABLE ticketing.checkout_answers IS 'Answers to checkout questions';

-- 10. Create order_addons table to track add-on purchases
CREATE TABLE IF NOT EXISTS ticketing.order_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES ticketing.orders(id) ON DELETE CASCADE,
  addon_id uuid NOT NULL REFERENCES ticketing.event_addons(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  price_cents integer NOT NULL, -- Snapshot price at purchase time
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_addons_order_id ON ticketing.order_addons(order_id);
CREATE INDEX IF NOT EXISTS idx_order_addons_addon_id ON ticketing.order_addons(addon_id);
COMMENT ON TABLE ticketing.order_addons IS 'Add-ons purchased as part of an order';

-- =====================================================
-- PART 5: TAG SYSTEM & STATISTICS
-- =====================================================

-- 11. Create event_tags table for tag statistics and autocomplete
CREATE TABLE IF NOT EXISTS events.event_tags (
  tag text PRIMARY KEY,
  usage_count integer DEFAULT 1,
  event_count integer DEFAULT 0,
  post_count integer DEFAULT 0,
  last_used timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  trending_score numeric DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_event_tags_usage_count ON events.event_tags(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_event_tags_trending ON events.event_tags(trending_score DESC, usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_event_tags_prefix ON events.event_tags(tag text_pattern_ops);

COMMENT ON TABLE events.event_tags IS 'Global event tags with usage statistics for autocomplete and trending';
COMMENT ON COLUMN events.event_tags.event_count IS 'Number of events using this tag';
COMMENT ON COLUMN events.event_tags.post_count IS 'Number of posts using this tag (for future integration)';
COMMENT ON COLUMN events.event_tags.trending_score IS 'Trending algorithm score (recency + usage)';

-- =====================================================
-- PART 6: FULL-TEXT SEARCH WITH TAGS
-- =====================================================

-- 12. Add search vector column (maintained by trigger, not generated)
ALTER TABLE events.events DROP COLUMN IF EXISTS search_vector CASCADE;
ALTER TABLE events.events ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_events_search_vector ON events.events USING GIN (search_vector);

-- 13. Function to update search vector
CREATE OR REPLACE FUNCTION events.update_event_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.venue, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.city, '')), 'C') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW.tags, ARRAY[]::text[]), ' ')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. Trigger to maintain search vector
DROP TRIGGER IF EXISTS trg_update_event_search_vector ON events.events;
CREATE TRIGGER trg_update_event_search_vector
  BEFORE INSERT OR UPDATE OF title, description, category, venue, city, tags
  ON events.events
  FOR EACH ROW
  EXECUTE FUNCTION events.update_event_search_vector();

-- 15. Populate search vector for existing events
UPDATE events.events SET search_vector = 
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(category, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(venue, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(city, '')), 'C') ||
  setweight(to_tsvector('english', array_to_string(coalesce(tags, ARRAY[]::text[]), ' ')), 'B')
WHERE search_vector IS NULL;

-- =====================================================
-- PART 7: TAG DISCOVERY FUNCTIONS
-- =====================================================

-- 14. Tag autocomplete function
CREATE OR REPLACE FUNCTION events.get_tag_suggestions(
  p_query text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  tag text,
  usage_count integer,
  event_count integer,
  trending_score numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    tag,
    usage_count,
    event_count,
    trending_score
  FROM events.event_tags
  WHERE tag ILIKE p_query || '%'
  ORDER BY 
    trending_score DESC,
    usage_count DESC,
    tag ASC
  LIMIT p_limit;
$$;

-- 15. Popular/trending tags function
CREATE OR REPLACE FUNCTION events.get_popular_tags(
  p_limit integer DEFAULT 20,
  p_timeframe_days integer DEFAULT 30
)
RETURNS TABLE (
  tag text,
  usage_count integer,
  event_count integer,
  is_trending boolean
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    tag,
    usage_count,
    event_count,
    trending_score > 0.7 AS is_trending
  FROM events.event_tags
  WHERE last_used > now() - (p_timeframe_days || ' days')::interval
  ORDER BY usage_count DESC, trending_score DESC
  LIMIT p_limit;
$$;

-- 16. Find events by tag
CREATE OR REPLACE FUNCTION events.get_events_by_tag(
  p_tag text,
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  event_id uuid,
  title text,
  description text,
  start_at timestamptz,
  city text,
  category text,
  tags text[],
  cover_image_url text,
  match_score numeric
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id AS event_id,
    e.title,
    e.description,
    e.start_at,
    e.city,
    e.category,
    e.tags,
    e.cover_image_url,
    CASE 
      WHEN e.tags @> ARRAY[p_tag] THEN 1.0
      WHEN EXISTS (SELECT 1 FROM unnest(e.tags) t WHERE t ILIKE '%' || p_tag || '%') THEN 0.7
      ELSE 0.5
    END AS match_score
  FROM events.events e
  WHERE 
    EXISTS (SELECT 1 FROM unnest(e.tags) t WHERE t ILIKE '%' || p_tag || '%')
    AND e.start_at > now()
    AND (e.visibility = 'public' OR (p_user_id IS NOT NULL AND e.visibility IN ('public', 'unlisted')))
  ORDER BY 
    match_score DESC,
    e.start_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 17. Enhanced search with tag boosting
CREATE OR REPLACE FUNCTION events.search_events_with_tags(
  p_query text,
  p_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  event_id uuid,
  title text,
  description text,
  start_at timestamptz,
  city text,
  category text,
  tags text[],
  cover_image_url text,
  relevance_score numeric,
  matched_tags text[]
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id AS event_id,
    e.title,
    e.description,
    e.start_at,
    e.city,
    e.category,
    e.tags,
    e.cover_image_url,
    (
      ts_rank(e.search_vector, plainto_tsquery('english', p_query)) * 0.7 +
      CASE 
        WHEN e.tags && string_to_array(lower(p_query), ' ') THEN 0.3
        ELSE 0
      END
    ) AS relevance_score,
    ARRAY(
      SELECT unnest(e.tags) 
      WHERE unnest(e.tags) = ANY(string_to_array(lower(p_query), ' '))
    ) AS matched_tags
  FROM events.events e
  WHERE 
    (
      e.search_vector @@ plainto_tsquery('english', p_query)
      OR e.tags && string_to_array(lower(p_query), ' ')
    )
    AND e.start_at > now()
    AND (e.visibility = 'public' OR (p_user_id IS NOT NULL AND e.visibility IN ('public', 'unlisted')))
  ORDER BY 
    relevance_score DESC,
    e.start_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- =====================================================
-- PART 8: TRENDING ALGORITHM
-- =====================================================

-- 18. Calculate trending tags
CREATE OR REPLACE FUNCTION events.calculate_trending_tags()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE events.event_tags
  SET trending_score = (
    0.7 * CASE 
      WHEN last_used > now() - interval '1 day' THEN 1.0
      WHEN last_used > now() - interval '3 days' THEN 0.8
      WHEN last_used > now() - interval '7 days' THEN 0.6
      WHEN last_used > now() - interval '14 days' THEN 0.4
      WHEN last_used > now() - interval '30 days' THEN 0.2
      ELSE 0.1
    END +
    0.3 * (usage_count::numeric / GREATEST(1, (SELECT MAX(usage_count) FROM events.event_tags)))
  );
END;
$$;

-- =====================================================
-- PART 9: TAG STATISTICS MAINTENANCE
-- =====================================================

-- 19. Trigger to maintain tag statistics
CREATE OR REPLACE FUNCTION events.maintain_tag_statistics()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.tags IS NOT NULL AND array_length(NEW.tags, 1) > 0 THEN
    INSERT INTO events.event_tags (tag, usage_count, event_count, last_used)
    SELECT 
      unnest(NEW.tags),
      1,
      1,
      now()
    ON CONFLICT (tag) DO UPDATE SET
      usage_count = events.event_tags.usage_count + 1,
      event_count = events.event_tags.event_count + 1,
      last_used = now();
      
  ELSIF TG_OP = 'UPDATE' AND (OLD.tags IS DISTINCT FROM NEW.tags) THEN
    -- Remove counts for deleted tags
    UPDATE events.event_tags
    SET 
      usage_count = GREATEST(0, usage_count - 1),
      event_count = GREATEST(0, event_count - 1)
    WHERE tag = ANY(COALESCE(OLD.tags, ARRAY[]::text[]))
      AND NOT (tag = ANY(COALESCE(NEW.tags, ARRAY[]::text[])));
    
    -- Add counts for new tags
    INSERT INTO events.event_tags (tag, usage_count, event_count, last_used)
    SELECT 
      t,
      1,
      1,
      now()
    FROM unnest(COALESCE(NEW.tags, ARRAY[]::text[])) AS t
    WHERE NOT (t = ANY(COALESCE(OLD.tags, ARRAY[]::text[])))
    ON CONFLICT (tag) DO UPDATE SET
      usage_count = events.event_tags.usage_count + 1,
      event_count = events.event_tags.event_count + 1,
      last_used = now();
      
  ELSIF TG_OP = 'DELETE' AND OLD.tags IS NOT NULL AND array_length(OLD.tags, 1) > 0 THEN
    UPDATE events.event_tags
    SET 
      usage_count = GREATEST(0, usage_count - 1),
      event_count = GREATEST(0, event_count - 1)
    WHERE tag = ANY(OLD.tags);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_maintain_tag_statistics ON events.events;
CREATE TRIGGER trg_maintain_tag_statistics
  AFTER INSERT OR UPDATE OF tags OR DELETE ON events.events
  FOR EACH ROW
  EXECUTE FUNCTION events.maintain_tag_statistics();

-- =====================================================
-- PART 10: INDEXES FOR PERFORMANCE
-- =====================================================

-- Tag-related indexes
CREATE INDEX IF NOT EXISTS idx_events_tags_gin ON events.events USING GIN (tags);
-- Index for tag-based filtering with date (no WHERE clause - now() is not immutable)
CREATE INDEX IF NOT EXISTS idx_events_tags_start_at ON events.events (tags, start_at);

-- =====================================================
-- PART 11: PERMISSIONS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ticketing.event_addons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ticketing.checkout_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ticketing.checkout_answers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ticketing.order_addons TO authenticated;
GRANT SELECT ON events.event_tags TO authenticated, anon;
GRANT INSERT, UPDATE ON events.event_tags TO authenticated;

GRANT EXECUTE ON FUNCTION events.get_tag_suggestions(text, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION events.get_popular_tags(integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION events.get_events_by_tag(text, uuid, integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION events.search_events_with_tags(text, uuid, integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION events.calculate_trending_tags() TO service_role;

-- =====================================================
-- PART 12: INITIAL DATA
-- =====================================================

-- Calculate initial trending scores
SELECT events.calculate_trending_tags();

-- Update event_count for any existing data
UPDATE events.event_tags et
SET event_count = (
  SELECT COUNT(*)
  FROM events.events e
  WHERE et.tag = ANY(e.tags)
)
WHERE event_count = 0;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON COLUMN events.events.tags IS 'Event tags for categorization, search, and discovery';

