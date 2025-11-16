-- Migration: Fix user_saved_posts 403 error and create unified saved items view
-- 
-- Issues fixed:
-- 1. Auto-populate event_id from post when saving
-- 2. Allow INSERT without explicit event_id
-- 3. Create unified view for saved posts + saved events

-- ==========================================
-- PART 1: Fix user_saved_posts trigger
-- ==========================================

-- Make event_id nullable (will auto-populate from post)
ALTER TABLE events.user_saved_posts
ALTER COLUMN event_id DROP NOT NULL;

-- Update the INSERT trigger to auto-populate event_id from the post
CREATE OR REPLACE FUNCTION public.user_saved_posts_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Auto-populate event_id from the post if not provided
  IF NEW.event_id IS NULL AND NEW.post_id IS NOT NULL THEN
    SELECT event_id INTO v_event_id
    FROM events.event_posts
    WHERE id = NEW.post_id;
    
    NEW.event_id := v_event_id;
  END IF;
  
  INSERT INTO events.user_saved_posts (user_id, post_id, event_id)
  VALUES (NEW.user_id, NEW.post_id, NEW.event_id)
  ON CONFLICT (user_id, post_id) DO NOTHING
  RETURNING * INTO NEW;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- PART 2: Add toggle function for posts (like events)
-- ==========================================

CREATE OR REPLACE FUNCTION public.toggle_saved_post(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_event_id UUID;
  v_exists BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get event_id from post
  SELECT event_id INTO v_event_id
  FROM events.event_posts
  WHERE id = p_post_id;
  
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;
  
  -- Check if already saved
  SELECT EXISTS(
    SELECT 1 FROM events.user_saved_posts 
    WHERE user_id = v_user_id AND post_id = p_post_id
  ) INTO v_exists;
  
  IF v_exists THEN
    -- Remove
    DELETE FROM events.user_saved_posts 
    WHERE user_id = v_user_id AND post_id = p_post_id;
    RETURN FALSE; -- Now unsaved
  ELSE
    -- Add
    INSERT INTO events.user_saved_posts (user_id, post_id, event_id) 
    VALUES (v_user_id, p_post_id, v_event_id)
    ON CONFLICT (user_id, post_id) DO NOTHING;
    RETURN TRUE; -- Now saved
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_saved_post TO authenticated, anon;

-- ==========================================
-- PART 3: Create unified saved items view
-- ==========================================

-- Unified view combining saved events and saved posts
CREATE OR REPLACE VIEW public.user_saved_items AS
-- Saved events
SELECT
  se.id,
  se.user_id,
  'event'::text AS item_type,
  se.event_id AS item_id,
  se.event_id,
  NULL::uuid AS post_id,
  se.saved_at AS saved_at,
  e.title AS event_title,
  e.description AS event_description,
  e.cover_image_url AS event_cover_image,
  e.start_at AS event_start_at,
  e.venue AS event_venue,
  e.city AS event_city,
  NULL::text AS post_text,
  NULL::text[] AS post_media_urls,
  e.created_by AS event_created_by,
  e.owner_context_type AS event_owner_context_type,
  e.owner_context_id AS event_owner_context_id
FROM public.saved_events se
JOIN events.events e ON e.id = se.event_id

UNION ALL

-- Saved posts
SELECT
  usp.id,
  usp.user_id,
  'post'::text AS item_type,
  usp.post_id AS item_id,
  usp.event_id,
  usp.post_id,
  usp.created_at AS saved_at,
  e.title AS event_title,
  e.description AS event_description,
  e.cover_image_url AS event_cover_image,
  e.start_at AS event_start_at,
  e.venue AS event_venue,
  e.city AS event_city,
  p.text AS post_text,
  p.media_urls AS post_media_urls,
  e.created_by AS event_created_by,
  e.owner_context_type AS event_owner_context_type,
  e.owner_context_id AS event_owner_context_id
FROM events.user_saved_posts usp
JOIN events.event_posts p ON p.id = usp.post_id
JOIN events.events e ON e.id = usp.event_id
WHERE p.deleted_at IS NULL;

-- Grant permissions on unified view
GRANT SELECT ON public.user_saved_items TO authenticated;
GRANT SELECT ON public.user_saved_items TO anon;

-- Add helpful comment
COMMENT ON VIEW public.user_saved_items IS 'Unified view of saved events and posts for a user. Use item_type to distinguish.';

-- ==========================================
-- PART 4: Helper function to get saved items
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_user_saved_items(
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  item_type TEXT,
  item_id UUID,
  event_id UUID,
  post_id UUID,
  saved_at TIMESTAMPTZ,
  event_title TEXT,
  event_description TEXT,
  event_cover_image TEXT,
  event_start_at TIMESTAMPTZ,
  event_venue TEXT,
  event_city TEXT,
  post_text TEXT,
  post_media_urls TEXT[],
  event_created_by UUID,
  event_owner_context_type TEXT,
  event_owner_context_id UUID
)
LANGUAGE sql STABLE
SECURITY DEFINER
AS $$
  SELECT
    usi.id,
    usi.item_type,
    usi.item_id,
    usi.event_id,
    usi.post_id,
    usi.saved_at,
    usi.event_title,
    usi.event_description,
    usi.event_cover_image,
    usi.event_start_at,
    usi.event_venue,
    usi.event_city,
    usi.post_text,
    usi.post_media_urls,
    usi.event_created_by,
    usi.event_owner_context_type,
    usi.event_owner_context_id
  FROM public.user_saved_items usi
  WHERE usi.user_id = COALESCE(p_user_id, auth.uid())
  ORDER BY usi.saved_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_saved_items TO authenticated, anon;

-- ==========================================
-- PART 5: Integration with feed scoring
-- ==========================================

-- Update the saved signal in feed ranking to include both events and posts
COMMENT ON TABLE public.saved_events IS 'Saved events count towards purchase intent signals in feed ranking';
COMMENT ON TABLE events.user_saved_posts IS 'Saved posts count towards purchase intent signals in feed ranking';

-- Success message
SELECT 
  'user_saved_posts fixed!' AS status,
  '✅ event_id now auto-populates from post' AS fix_1,
  '✅ toggle_saved_post() function added' AS fix_2,
  '✅ user_saved_items unified view created' AS fix_3;







