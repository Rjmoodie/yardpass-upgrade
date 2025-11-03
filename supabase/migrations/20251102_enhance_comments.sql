-- =====================================================
-- ENHANCE COMMENTS: PIN, THREADING, RICH TEXT
-- =====================================================
-- This migration adds:
-- 1. Comment pinning (organizers can pin important comments to top)
-- 2. Threading/Replies (nested comment structure)
-- 3. Rich text support (mentions, parsed links)

-- =====================================================
-- 1. ADD NEW COLUMNS TO event_comments
-- =====================================================

-- Add is_pinned for pinning feature
ALTER TABLE events.event_comments 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Add parent_comment_id for threading
ALTER TABLE events.event_comments 
ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES events.event_comments(id) ON DELETE CASCADE;

-- Add mentions for rich text (@username tracking)
ALTER TABLE events.event_comments 
ADD COLUMN IF NOT EXISTS mentions JSONB DEFAULT '[]'::jsonb;

-- Add deleted_at for soft deletes (preserve thread structure)
ALTER TABLE events.event_comments 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Add reply_count for quick display
ALTER TABLE events.event_comments 
ADD COLUMN IF NOT EXISTS reply_count INTEGER NOT NULL DEFAULT 0;

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for fetching pinned comments first
CREATE INDEX IF NOT EXISTS idx_event_comments_pinned_created 
ON events.event_comments(post_id, is_pinned DESC, created_at DESC) 
WHERE deleted_at IS NULL;

-- Index for threading (fetching replies)
CREATE INDEX IF NOT EXISTS idx_event_comments_parent 
ON events.event_comments(parent_comment_id, created_at ASC) 
WHERE deleted_at IS NULL AND parent_comment_id IS NOT NULL;

-- Index for top-level comments (no parent)
CREATE INDEX IF NOT EXISTS idx_event_comments_top_level 
ON events.event_comments(post_id, created_at DESC) 
WHERE deleted_at IS NULL AND parent_comment_id IS NULL;

-- Index for user mentions
CREATE INDEX IF NOT EXISTS idx_event_comments_mentions 
ON events.event_comments USING GIN(mentions);

-- =====================================================
-- 3. UPDATE REPLY COUNT TRIGGER
-- =====================================================

-- Function to update reply count
CREATE OR REPLACE FUNCTION events.update_comment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
    -- Increment parent's reply count
    UPDATE events.event_comments
    SET reply_count = COALESCE(reply_count, 0) + 1
    WHERE id = NEW.parent_comment_id;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NOT NULL THEN
    -- Decrement parent's reply count
    UPDATE events.event_comments
    SET reply_count = GREATEST(COALESCE(reply_count, 0) - 1, 0)
    WHERE id = OLD.parent_comment_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle parent change (edge case)
    IF OLD.parent_comment_id IS NOT NULL AND OLD.parent_comment_id != NEW.parent_comment_id THEN
      UPDATE events.event_comments
      SET reply_count = GREATEST(COALESCE(reply_count, 0) - 1, 0)
      WHERE id = OLD.parent_comment_id;
    END IF;
    IF NEW.parent_comment_id IS NOT NULL AND OLD.parent_comment_id != NEW.parent_comment_id THEN
      UPDATE events.event_comments
      SET reply_count = COALESCE(reply_count, 0) + 1
      WHERE id = NEW.parent_comment_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for reply count
DROP TRIGGER IF EXISTS trigger_update_comment_reply_count ON events.event_comments;
CREATE TRIGGER trigger_update_comment_reply_count
AFTER INSERT OR DELETE OR UPDATE OF parent_comment_id ON events.event_comments
FOR EACH ROW
EXECUTE FUNCTION events.update_comment_reply_count();

-- =====================================================
-- 4. UPDATE comment_count TRIGGER TO RESPECT THREADING
-- =====================================================

-- Only count top-level comments (not replies) in post's comment_count
CREATE OR REPLACE FUNCTION events.update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NULL THEN
    -- Only increment for top-level comments
    UPDATE events.event_posts
    SET comment_count = COALESCE(comment_count, 0) + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NULL THEN
    -- Only decrement for top-level comments
    UPDATE events.event_posts
    SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0)
    WHERE id = OLD.post_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle soft delete (deleted_at changed)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL AND NEW.parent_comment_id IS NULL THEN
      -- Comment was soft deleted
      UPDATE events.event_posts
      SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0)
      WHERE id = NEW.post_id;
    ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL AND NEW.parent_comment_id IS NULL THEN
      -- Comment was restored
      UPDATE events.event_posts
      SET comment_count = COALESCE(comment_count, 0) + 1
      WHERE id = NEW.post_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 5. BACKFILL reply_count FOR EXISTING COMMENTS
-- =====================================================

UPDATE events.event_comments parent
SET reply_count = (
  SELECT COUNT(*)
  FROM events.event_comments child
  WHERE child.parent_comment_id = parent.id
  AND child.deleted_at IS NULL
)
WHERE EXISTS (
  SELECT 1 
  FROM events.event_comments child
  WHERE child.parent_comment_id = parent.id
);

-- =====================================================
-- 6. ADD RLS POLICIES FOR NEW FEATURES
-- =====================================================

-- Allow organizers to pin/unpin comments
-- Note: Uses is_event_manager function which checks if user created event or is org editor
DROP POLICY IF EXISTS "Organizers can pin comments" ON events.event_comments;

CREATE POLICY "Organizers can pin comments"
ON events.event_comments
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM events.event_posts ep
    WHERE ep.id = event_comments.post_id
      AND public.is_event_manager(ep.event_id)
  )
);

-- =====================================================
-- 7. UPDATE PUBLIC VIEW TO EXPOSE NEW COLUMNS
-- =====================================================

-- PostgREST uses public.event_comments view, so we must update it
CREATE OR REPLACE VIEW public.event_comments AS
SELECT 
  id,
  post_id,
  author_user_id,
  text,
  created_at,
  client_id,
  is_pinned,
  parent_comment_id,
  mentions,
  deleted_at,
  reply_count
FROM events.event_comments;

-- Ensure permissions are maintained
GRANT ALL ON public.event_comments TO authenticated;
GRANT ALL ON public.event_comments TO anon;
GRANT ALL ON public.event_comments TO service_role;

-- =====================================================
-- 8. COMMENTS
-- =====================================================

COMMENT ON COLUMN events.event_comments.is_pinned IS 'True if comment is pinned by organizer (appears at top)';
COMMENT ON COLUMN events.event_comments.parent_comment_id IS 'Parent comment ID for threaded replies (NULL for top-level)';
COMMENT ON COLUMN events.event_comments.mentions IS 'Array of mentioned user IDs for notifications and @username parsing';
COMMENT ON COLUMN events.event_comments.deleted_at IS 'Soft delete timestamp (preserves thread structure)';
COMMENT ON COLUMN events.event_comments.reply_count IS 'Cached count of direct replies to this comment';

COMMENT ON FUNCTION events.update_comment_reply_count() IS 'Automatically updates reply_count when replies are added/removed';

