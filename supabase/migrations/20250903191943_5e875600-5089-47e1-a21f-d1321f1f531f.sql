-- Who can scan for an event (delegation)
CREATE TABLE IF NOT EXISTS public.event_scanners (
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'enabled', -- 'enabled' | 'disabled'
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- Scan logs for analytics & anti-fraud
CREATE TABLE IF NOT EXISTS public.scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  scanner_user_id uuid REFERENCES auth.users(id),
  result text NOT NULL, -- valid | duplicate | expired | invalid | wrong_event | refunded | void
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.event_scanners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_logs ENABLE ROW LEVEL SECURITY;

-- Scanners: organizers (editor/admin/owner) manage; scanners can read their own assignment
CREATE POLICY event_scanners_read_self
  ON public.event_scanners FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_event_manager(event_id)
    OR public.is_event_org_editor(event_id)
  );

CREATE POLICY event_scanners_manage_by_org
  ON public.event_scanners FOR ALL
  USING (public.is_event_manager(event_id))
  WITH CHECK (public.is_event_manager(event_id));

-- Scan logs: organizer/editor/scanner of that event can read; writes via Edge Function service role only
CREATE POLICY scan_logs_select_event_team
  ON public.scan_logs FOR SELECT
  USING (
    public.is_event_manager(event_id)
    OR EXISTS (
      SELECT 1 FROM public.event_scanners s
      WHERE s.event_id = scan_logs.event_id
        AND s.user_id = auth.uid()
        AND s.status = 'enabled'
    )
  );