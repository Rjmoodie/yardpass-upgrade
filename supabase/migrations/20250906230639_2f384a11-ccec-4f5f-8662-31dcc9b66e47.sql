-- event_share_assets: organizers pick story/link creatives for sharing
CREATE TABLE IF NOT EXISTS public.event_share_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  
  kind text NOT NULL CHECK (kind IN ('story_video','story_image','link_video','link_image')),
  
  -- Supabase storage for images
  storage_path text NULL,
  
  -- Mux fields for videos
  mux_upload_id text NULL,
  mux_asset_id text NULL,
  mux_playback_id text NULL,
  poster_url text NULL,
  
  duration_seconds int NULL,
  width int NULL,
  height int NULL,
  
  active boolean NOT NULL DEFAULT true,
  title text NULL,
  caption text NULL
);

CREATE INDEX IF NOT EXISTS event_share_assets_event_active_idx
  ON public.event_share_assets (event_id, active);

ALTER TABLE public.event_share_assets ENABLE ROW LEVEL SECURITY;

-- Public read-only when event is public and asset is active
CREATE POLICY "share_assets_read_public"
ON public.event_share_assets FOR SELECT
TO public
USING (
  active = true AND EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_id AND e.visibility = 'public'
  )
);

-- Organizers/admins/editors can manage
CREATE POLICY "share_assets_manage_org"
ON public.event_share_assets FOR ALL
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.events ev
    WHERE ev.id = event_id AND (
      ev.created_by = auth.uid() OR (
        ev.owner_context_type = 'organization' AND EXISTS (
          SELECT 1 FROM public.org_memberships om
          WHERE om.org_id = ev.owner_context_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner','admin','editor')
        )
      )
    )
  )
)
WITH CHECK (true);

-- Optional short links table for clean share URLs
CREATE TABLE IF NOT EXISTS public.share_links (
  code text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL,
  content_type text NOT NULL CHECK (content_type IN ('event','post','org','user')),
  content_id uuid NOT NULL,
  channel text NULL,
  params jsonb NOT NULL DEFAULT '{}',
  clicks int NOT NULL DEFAULT 0,
  last_clicked_at timestamptz
);

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "share_links_public_read"
ON public.share_links FOR SELECT TO public USING (true);

CREATE POLICY "share_links_insert_auth"
ON public.share_links FOR INSERT TO authenticated WITH CHECK (true);