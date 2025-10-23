-- 003_create_hashtags_mentions.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.hashtags (
  tag text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.post_hashtags (
  post_id uuid REFERENCES public.event_posts(id) ON DELETE CASCADE,
  tag text REFERENCES public.hashtags(tag) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag)
);

CREATE TABLE IF NOT EXISTS public.post_mentions (
  post_id uuid REFERENCES public.event_posts(id) ON DELETE CASCADE,
  mentioned_user_id uuid REFERENCES auth.users(id),
  PRIMARY KEY (post_id, mentioned_user_id)
);

COMMIT;
