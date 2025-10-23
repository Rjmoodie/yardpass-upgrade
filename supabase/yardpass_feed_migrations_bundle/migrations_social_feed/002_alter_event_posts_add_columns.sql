-- 002_alter_event_posts_add_columns.sql
BEGIN;

ALTER TABLE public.event_posts
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'post'
    CHECK (post_type IN ('post','reshare','announcement','ad'));
ALTER TABLE public.event_posts
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','followers','private'));
ALTER TABLE public.event_posts
  ADD COLUMN IF NOT EXISTS reply_count int NOT NULL DEFAULT 0;
ALTER TABLE public.event_posts
  ADD COLUMN IF NOT EXISTS share_count int NOT NULL DEFAULT 0;
ALTER TABLE public.event_posts
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.event_posts
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
ALTER TABLE public.event_posts
  ADD COLUMN IF NOT EXISTS link_url text;
ALTER TABLE public.event_posts
  ADD COLUMN IF NOT EXISTS link_meta jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.event_posts
  ADD COLUMN IF NOT EXISTS moderation_state text NOT NULL DEFAULT 'clean'
    CHECK (moderation_state IN ('clean','flagged','removed'));
ALTER TABLE public.event_posts
  ADD COLUMN IF NOT EXISTS language text;

COMMIT;
