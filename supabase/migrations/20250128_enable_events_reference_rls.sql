-- ============================================================================
-- ENABLE RLS ON EVENTS REFERENCE/JUNCTION TABLES
-- ============================================================================
-- Tags, hashtags, media relationships
-- ============================================================================

-- ============================================================================
-- PART 1: Reference Tables - Public Read, Authenticated Write
-- ============================================================================

-- hashtags - Hashtag lookup table (public read, authenticated write)
ALTER TABLE events.hashtags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read hashtags"
  ON events.hashtags
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert hashtags"
  ON events.hashtags
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Service role full access to hashtags"
  ON events.hashtags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- event_tags - Event-tag relationships (public read, event owner/admin write)
ALTER TABLE events.event_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read event tags for visible events"
  ON events.event_tags
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM events.events ev
      WHERE ev.id = event_tags.event_id
        AND ev.visibility = 'public'
        AND ev.deleted_at IS NULL
    )
  );

CREATE POLICY "Event managers can manage tags for their events"
  ON events.event_tags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events.events ev
      WHERE ev.id = event_tags.event_id
        AND (
          ev.created_by = auth.uid()
          OR (ev.owner_context_type = 'organization' AND EXISTS (
            SELECT 1 FROM organizations.org_memberships om
            WHERE om.org_id = ev.owner_context_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'editor')
          ))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events.events ev
      WHERE ev.id = event_tags.event_id
        AND (
          ev.created_by = auth.uid()
          OR (ev.owner_context_type = 'organization' AND EXISTS (
            SELECT 1 FROM organizations.org_memberships om
            WHERE om.org_id = ev.owner_context_id
              AND om.user_id = auth.uid()
              AND om.role IN ('owner', 'admin', 'editor')
          ))
        )
    )
  );

CREATE POLICY "Service role full access to event_tags"
  ON events.event_tags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PART 2: Post Relationship Tables - Respect Post Visibility
-- ============================================================================

-- post_hashtags - Post-hashtag relationships
ALTER TABLE events.post_hashtags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read post hashtags for visible posts"
  ON events.post_hashtags
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM events.event_posts ep
      JOIN events.events ev ON ev.id = ep.event_id
      WHERE ep.id = post_hashtags.post_id
        AND ep.deleted_at IS NULL
        AND ev.visibility = 'public'
        AND ev.deleted_at IS NULL
    )
  );

CREATE POLICY "Post authors can manage hashtags on their posts"
  ON events.post_hashtags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events.event_posts ep
      WHERE ep.id = post_hashtags.post_id
        AND ep.author_user_id = auth.uid()
        AND ep.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events.event_posts ep
      WHERE ep.id = post_hashtags.post_id
        AND ep.author_user_id = auth.uid()
        AND ep.deleted_at IS NULL
    )
  );

CREATE POLICY "Service role full access to post_hashtags"
  ON events.post_hashtags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- post_media - Post-media relationships
ALTER TABLE events.post_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read post media for visible posts"
  ON events.post_media
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM events.event_posts ep
      JOIN events.events ev ON ev.id = ep.event_id
      WHERE ep.id = post_media.post_id
        AND ep.deleted_at IS NULL
        AND ev.visibility = 'public'
        AND ev.deleted_at IS NULL
    )
  );

CREATE POLICY "Post authors can manage media on their posts"
  ON events.post_media
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events.event_posts ep
      WHERE ep.id = post_media.post_id
        AND ep.author_user_id = auth.uid()
        AND ep.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events.event_posts ep
      WHERE ep.id = post_media.post_id
        AND ep.author_user_id = auth.uid()
        AND ep.deleted_at IS NULL
    )
  );

CREATE POLICY "Service role full access to post_media"
  ON events.post_media
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- post_mentions - Post mentions
ALTER TABLE events.post_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read post mentions for visible posts"
  ON events.post_mentions
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM events.event_posts ep
      JOIN events.events ev ON ev.id = ep.event_id
      WHERE ep.id = post_mentions.post_id
        AND ep.deleted_at IS NULL
        AND ev.visibility = 'public'
        AND ev.deleted_at IS NULL
    )
  );

CREATE POLICY "Post authors can manage mentions on their posts"
  ON events.post_mentions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events.event_posts ep
      WHERE ep.id = post_mentions.post_id
        AND ep.author_user_id = auth.uid()
        AND ep.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events.event_posts ep
      WHERE ep.id = post_mentions.post_id
        AND ep.author_user_id = auth.uid()
        AND ep.deleted_at IS NULL
    )
  );

CREATE POLICY "Service role full access to post_mentions"
  ON events.post_mentions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PART 3: Media Assets - Respect Ownership
-- ============================================================================

-- media_assets - Media asset metadata
ALTER TABLE events.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read media assets for visible posts/events"
  ON events.media_assets
  FOR SELECT
  TO public
  USING (
    -- Media is visible if it's linked to a visible post
    EXISTS (
      SELECT 1 FROM events.post_media pm
      JOIN events.event_posts ep ON ep.id = pm.post_id
      JOIN events.events ev ON ev.id = ep.event_id
      WHERE pm.media_asset_id = media_assets.id
        AND ep.deleted_at IS NULL
        AND ev.visibility = 'public'
        AND ev.deleted_at IS NULL
    )
    OR
    -- Or if it's linked to a visible event directly
    EXISTS (
      SELECT 1 FROM events.events ev
      WHERE ev.media_asset_id = media_assets.id
        AND ev.visibility = 'public'
        AND ev.deleted_at IS NULL
    )
  );

CREATE POLICY "Media owners can manage their media assets"
  ON events.media_assets
  FOR ALL
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM events.event_posts ep
      JOIN events.post_media pm ON pm.post_id = ep.id
      WHERE pm.media_asset_id = media_assets.id
        AND ep.author_user_id = auth.uid()
    )
  )
  WITH CHECK (
    uploaded_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM events.event_posts ep
      JOIN events.post_media pm ON pm.post_id = ep.id
      WHERE pm.media_asset_id = media_assets.id
        AND ep.author_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access to media_assets"
  ON events.media_assets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS Disabled'
    END as status
FROM pg_tables
WHERE schemaname = 'events'
    AND tablename IN (
        'event_tags',
        'hashtags',
        'post_hashtags',
        'post_media',
        'post_mentions',
        'media_assets'
    )
ORDER BY tablename;


