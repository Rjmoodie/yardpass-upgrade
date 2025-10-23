-- 005_indexes_for_feed.sql
BEGIN;

CREATE INDEX IF NOT EXISTS event_posts_eventid_createdat_desc
  ON public.event_posts (event_id, created_at DESC)
  WHERE deleted_at IS NULL AND visibility = 'public' AND moderation_state <> 'removed';

CREATE INDEX IF NOT EXISTS event_posts_authorid_createdat_desc
  ON public.event_posts (author_user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS event_posts_pinned_idx
  ON public.event_posts (event_id, pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS post_media_postid_pos_idx ON public.post_media (post_id, position);
CREATE INDEX IF NOT EXISTS media_assets_status_createdat_idx ON public.media_assets (status, created_at);

CREATE INDEX IF NOT EXISTS event_comments_postid_createdat_idx
  ON public.event_comments (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS event_reactions_userid_createdat_idx
  ON public.event_reactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS post_views_postid_createdat_idx
  ON public.post_views (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS post_impr_postid_createdat_idx
  ON public.post_impressions (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS post_hashtags_tag_post_idx ON public.post_hashtags (tag, post_id);
CREATE INDEX IF NOT EXISTS post_mentions_user_post_idx ON public.post_mentions (mentioned_user_id, post_id);

CREATE INDEX IF NOT EXISTS event_posts_linkmeta_gin ON public.event_posts USING GIN (link_meta);

COMMIT;
