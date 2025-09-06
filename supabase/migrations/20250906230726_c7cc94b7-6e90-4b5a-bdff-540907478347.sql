-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "share_assets_read_public" ON public.event_share_assets;
DROP POLICY IF EXISTS "share_assets_manage_org" ON public.event_share_assets;

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