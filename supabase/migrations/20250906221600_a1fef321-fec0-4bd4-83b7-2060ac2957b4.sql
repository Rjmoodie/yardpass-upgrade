-- Schema upgrades for posting system
-- 1.1 Add counters, soft delete, and updated_at to event_posts
ALTER TABLE public.event_posts
  ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

-- Updated at trigger
DROP TRIGGER IF EXISTS trg_touch_post ON public.event_posts;
CREATE TRIGGER trg_touch_post
  BEFORE UPDATE ON public.event_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_event_posts_event_created_at ON public.event_posts (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_posts_author_created_at ON public.event_posts (author_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_posts_not_deleted ON public.event_posts (event_id) WHERE deleted_at IS NULL;

-- 1.2 Reactions unique constraint
ALTER TABLE public.event_reactions
  ADD CONSTRAINT IF NOT EXISTS event_reactions_unique UNIQUE (post_id, user_id, kind);

CREATE INDEX IF NOT EXISTS idx_reactions_post_kind ON public.event_reactions (post_id, kind);

-- 1.3 Comments index
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON public.event_comments (post_id, created_at ASC);

-- 1.4 Counter triggers
CREATE OR REPLACE FUNCTION public.inc_like_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.event_posts
  SET like_count = like_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_like_ins ON public.event_reactions;
CREATE TRIGGER trg_like_ins
  AFTER INSERT ON public.event_reactions
  FOR EACH ROW WHEN (NEW.kind = 'like')
  EXECUTE FUNCTION public.inc_like_count();

DROP TRIGGER IF EXISTS trg_like_del ON public.event_reactions;
CREATE TRIGGER trg_like_del
  AFTER DELETE ON public.event_reactions
  FOR EACH ROW WHEN (OLD.kind = 'like')
  EXECUTE FUNCTION public.inc_like_count();

CREATE OR REPLACE FUNCTION public.inc_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.event_posts
  SET comment_count = comment_count + CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END
  WHERE id = COALESCE(NEW.post_id, OLD.post_id);
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_comment_ins ON public.event_comments;
CREATE TRIGGER trg_comment_ins
  AFTER INSERT ON public.event_comments
  FOR EACH ROW EXECUTE FUNCTION public.inc_comment_count();

DROP TRIGGER IF EXISTS trg_comment_del ON public.event_comments;
CREATE TRIGGER trg_comment_del
  AFTER DELETE ON public.event_comments
  FOR EACH ROW EXECUTE FUNCTION public.inc_comment_count();

-- 1.5 Helper view with metadata
CREATE OR REPLACE VIEW public.event_posts_with_meta AS
SELECT
  p.*,
  u.display_name AS author_name,
  u.photo_url AS author_photo_url,
  e.title AS event_title,
  -- Author's ticket badge for this event
  (
    SELECT tt.badge_label
    FROM public.tickets t
    JOIN public.ticket_tiers tt ON tt.id = t.tier_id
    WHERE t.event_id = p.event_id
      AND t.owner_user_id = p.author_user_id
      AND t.status IN ('issued','transferred','redeemed')
    ORDER BY t.created_at DESC
    LIMIT 1
  ) AS author_badge_label,
  -- Is author an organizer?
  EXISTS (
    SELECT 1
    FROM public.events ev
    WHERE ev.id = p.event_id
      AND (
        ev.created_by = p.author_user_id
        OR (
          ev.owner_context_type = 'organization'
          AND EXISTS (
            SELECT 1 FROM public.org_memberships om
            WHERE om.org_id = ev.owner_context_id
              AND om.user_id = p.author_user_id
              AND om.role IN ('owner','admin','editor')
          )
        )
      )
  ) AS author_is_organizer
FROM public.event_posts p
JOIN public.user_profiles u ON u.user_id = p.author_user_id
JOIN public.events e ON e.id = p.event_id
WHERE p.deleted_at IS NULL;

-- 1.6 Permission helper function
CREATE OR REPLACE FUNCTION public.can_current_user_post(target_event_id UUID, uid UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT
    EXISTS (
      -- Organizer/editor/owner
      SELECT 1
      FROM public.events ev
      WHERE ev.id = target_event_id
        AND (
          ev.created_by = uid
          OR (
            ev.owner_context_type = 'organization'
            AND EXISTS (
              SELECT 1 FROM public.org_memberships om
              WHERE om.org_id = ev.owner_context_id
                AND om.user_id = uid
                AND om.role IN ('owner','admin','editor')
            )
          )
        )
    )
    OR EXISTS (
      -- Valid ticket holder
      SELECT 1
      FROM public.tickets t
      WHERE t.event_id = target_event_id
        AND t.owner_user_id = uid
        AND t.status IN ('issued','transferred','redeemed')
    );
$$;

-- 2. RLS Policies
-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "posts_read_public" ON public.event_posts;
DROP POLICY IF EXISTS "posts_insert_ticket_or_org" ON public.event_posts;
DROP POLICY IF EXISTS "posts_update_author_or_admin" ON public.event_posts;
DROP POLICY IF EXISTS "posts_delete_author_or_admin" ON public.event_posts;
DROP POLICY IF EXISTS "comments_select_public" ON public.event_comments;
DROP POLICY IF EXISTS "comments_insert_any_auth" ON public.event_comments;
DROP POLICY IF EXISTS "event_reactions_select_public" ON public.event_reactions;
DROP POLICY IF EXISTS "event_reactions_insert_auth" ON public.event_reactions;
DROP POLICY IF EXISTS "event_reactions_delete_self" ON public.event_reactions;

-- Posts policies
CREATE POLICY "posts_read_public_or_access"
ON public.event_posts FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.visibility = 'public')
  OR (
    auth.role() = 'authenticated'
    AND (
      public.can_current_user_post(event_id, auth.uid())
      OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.visibility = 'unlisted')
    )
  )
);

CREATE POLICY "posts_insert_authorized"
ON public.event_posts FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' 
  AND public.can_current_user_post(event_id, auth.uid()) 
  AND author_user_id = auth.uid()
);

CREATE POLICY "posts_modify_owner_or_org"
ON public.event_posts FOR UPDATE USING (
  auth.role() = 'authenticated'
  AND (
    author_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events ev
      WHERE ev.id = event_id
        AND (
          ev.created_by = auth.uid()
          OR (
            ev.owner_context_type = 'organization'
            AND EXISTS (
              SELECT 1 FROM public.org_memberships om
              WHERE om.org_id = ev.owner_context_id
                AND om.user_id = auth.uid()
                AND om.role IN ('owner','admin','editor')
            )
          )
        )
    )
  )
);

CREATE POLICY "posts_delete_owner_or_org"
ON public.event_posts FOR DELETE USING (
  auth.role() = 'authenticated'
  AND (
    author_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events ev
      WHERE ev.id = event_id
        AND (
          ev.created_by = auth.uid()
          OR (
            ev.owner_context_type = 'organization'
            AND EXISTS (
              SELECT 1 FROM public.org_memberships om
              WHERE om.org_id = ev.owner_context_id
                AND om.user_id = auth.uid()
                AND om.role IN ('owner','admin','editor')
            )
          )
        )
    )
  )
);

-- Comments policies
CREATE POLICY "comments_read_public_or_access"
ON public.event_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.event_posts p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = post_id AND (
      e.visibility = 'public'
      OR (
        auth.role() = 'authenticated' 
        AND (
          public.can_current_user_post(p.event_id, auth.uid()) 
          OR e.visibility = 'unlisted'
        )
      )
    )
  )
);

CREATE POLICY "comments_insert_access"
ON public.event_comments FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.event_posts p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = post_id
      AND (
        e.visibility = 'public'
        OR public.can_current_user_post(p.event_id, auth.uid())
        OR e.visibility = 'unlisted'
      )
  )
);

-- Reactions policies
CREATE POLICY "reactions_read_public_or_access"
ON public.event_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.event_posts p
    JOIN public.events e ON e.id = p.event_id
    WHERE p.id = post_id AND (
      e.visibility = 'public'
      OR (
        auth.role() = 'authenticated' 
        AND (
          public.can_current_user_post(p.event_id, auth.uid()) 
          OR e.visibility = 'unlisted'
        )
      )
    )
  )
);

CREATE POLICY "reactions_insert_access"
ON public.event_reactions FOR INSERT
WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "reactions_delete_self"
ON public.event_reactions FOR DELETE
USING (auth.role() = 'authenticated' AND user_id = auth.uid());