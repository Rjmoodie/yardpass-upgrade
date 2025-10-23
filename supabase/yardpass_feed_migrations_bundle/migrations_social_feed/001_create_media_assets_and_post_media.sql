-- 001_create_media_assets_and_post_media.sql
BEGIN;

CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id),
  storage_path text,
  mux_upload_id text,
  mux_asset_id text,
  mux_playback_id text,
  poster_url text,
  width int, height int, duration_seconds int,
  media_type text NOT NULL CHECK (media_type IN ('image','video','gif')),
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','ready','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.post_media (
  post_id uuid NOT NULL REFERENCES public.event_posts(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, media_id)
);

COMMIT;
