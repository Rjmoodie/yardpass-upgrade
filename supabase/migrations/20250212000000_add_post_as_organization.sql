-- ============================================================================
-- Add "Post as Organization" Feature
-- ============================================================================
-- Allows users to choose whether to post as themselves or as an organization
-- they're a member of (similar to Facebook Pages or LinkedIn Company Pages)
-- ============================================================================

-- Add columns to track posting identity
ALTER TABLE events.event_posts
  ADD COLUMN IF NOT EXISTS post_as_context_type TEXT,
  ADD COLUMN IF NOT EXISTS post_as_context_id UUID;

-- Add constraint to ensure valid context types
ALTER TABLE events.event_posts
  ADD CONSTRAINT event_posts_post_as_context_type_check 
  CHECK (post_as_context_type IS NULL OR post_as_context_type IN ('organization'));

-- Add consistency constraint: if type is set, id must be set (and vice versa)
-- This ensures data integrity: can't have 'organization' type without an org_id
ALTER TABLE events.event_posts
  ADD CONSTRAINT event_posts_post_as_context_consistency_check
  CHECK (
    (post_as_context_type IS NULL AND post_as_context_id IS NULL)
    OR
    (post_as_context_type = 'organization' AND post_as_context_id IS NOT NULL)
  );

-- Add foreign key constraint to ensure post_as_context_id references a valid organization
-- This prevents orphaned references if an organization is deleted
-- Note: We use RESTRICT to prevent accidental org deletion with posts. 
-- If needed, manually clear post_as fields before deleting org.
ALTER TABLE events.event_posts
  ADD CONSTRAINT event_posts_post_as_org_fk
  FOREIGN KEY (post_as_context_id)
  REFERENCES organizations.organizations(id)
  ON DELETE RESTRICT;  -- Prevent org deletion if posts exist. Clear post_as fields first if needed.

-- Add comments explaining the feature
COMMENT ON COLUMN events.event_posts.post_as_context_type IS 
'When set to "organization", the post is displayed as if posted by the organization. The actual author_user_id still tracks who created it. NULL means post as individual user.';
COMMENT ON COLUMN events.event_posts.post_as_context_id IS 
'When post_as_context_type is "organization", this contains the organization UUID. Used to display organization name/logo instead of user. Must be NOT NULL when post_as_context_type is set.';

-- Add composite index for efficient queries with sorting by created_at
-- Common query pattern: "Get all posts by this organization, sorted by date"
-- Only create if table and columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'events' 
    AND table_name = 'event_posts'
    AND column_name = 'post_as_context_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_event_posts_post_as_org_created_at
      ON events.event_posts(post_as_context_id, created_at DESC)
      WHERE post_as_context_type = 'organization';
    
    RAISE NOTICE '✅ Created index: idx_event_posts_post_as_org_created_at';
    
    -- Add comment on index (only if index exists)
    IF EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'events' 
      AND tablename = 'event_posts' 
      AND indexname = 'idx_event_posts_post_as_org_created_at'
    ) THEN
      EXECUTE 'COMMENT ON INDEX events.idx_event_posts_post_as_org_created_at IS 
        ''Composite index for efficient queries of posts made "as" an organization, sorted by creation date. Optimizes queries like "all posts by org X, newest first".''';
      RAISE NOTICE '✅ Added comment to index: idx_event_posts_post_as_org_created_at';
    END IF;
  ELSE
    RAISE NOTICE '⚠️ Skipped index creation: post_as_context_id column does not exist yet';
  END IF;
END $$;

