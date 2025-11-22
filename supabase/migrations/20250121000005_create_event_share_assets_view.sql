-- Create event_share_assets table in events schema if it doesn't exist
-- Then create public view for PostgREST API access

-- First, ensure the table exists in events schema
CREATE TABLE IF NOT EXISTS events.event_share_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  event_id uuid NOT NULL REFERENCES events.events(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind = ANY (ARRAY['story_video', 'story_image', 'link_video', 'link_image'])),
  storage_path text,
  mux_upload_id text,
  mux_asset_id text,
  mux_playback_id text,
  poster_url text,
  duration_seconds integer,
  width integer,
  height integer,
  active boolean NOT NULL DEFAULT true,
  title text,
  caption text
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS event_share_assets_event_active_idx 
  ON events.event_share_assets(event_id, active);

CREATE INDEX IF NOT EXISTS event_share_assets_mux_upload_id_idx 
  ON events.event_share_assets(mux_upload_id) 
  WHERE mux_upload_id IS NOT NULL;

-- Enable RLS
ALTER TABLE events.event_share_assets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "share_assets_manage_org" ON events.event_share_assets;
DROP POLICY IF EXISTS "share_assets_read_public" ON events.event_share_assets;

-- RLS Policy 1: Event managers can manage assets (INSERT, UPDATE, DELETE, SELECT)
CREATE POLICY "share_assets_manage_by_manager"
ON events.event_share_assets
FOR ALL
TO authenticated
USING (
  public.is_event_manager(event_id)
)
WITH CHECK (
  public.is_event_manager(event_id)
);

-- RLS Policy 2: Public can read active assets for public events (SELECT only)
CREATE POLICY "share_assets_read_public"
ON events.event_share_assets
FOR SELECT
TO authenticated, anon
USING (
  active = true
  AND EXISTS (
    SELECT 1 FROM events.events e
    WHERE e.id = event_share_assets.event_id
      AND e.visibility = 'public'
  )
);

-- Create public view for PostgREST API access
DROP VIEW IF EXISTS public.event_share_assets CASCADE;

CREATE VIEW public.event_share_assets AS
SELECT * FROM events.event_share_assets;

-- Grant permissions on the view
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_share_assets TO authenticated;
GRANT SELECT ON public.event_share_assets TO anon;
GRANT ALL ON public.event_share_assets TO service_role;

-- Set security invoker (view uses caller's permissions, not definer's)
ALTER VIEW public.event_share_assets SET (security_invoker = true);

-- Grant permissions on the underlying table
GRANT ALL ON events.event_share_assets TO authenticated;
GRANT SELECT ON events.event_share_assets TO anon;
GRANT ALL ON events.event_share_assets TO service_role;

-- Comments
COMMENT ON TABLE events.event_share_assets IS 
  'Stores Mux video uploads and share assets for events';

COMMENT ON VIEW public.event_share_assets IS 
  'Public view for event_share_assets table. Uses RLS policies from events.event_share_assets.';

