-- Enable RLS on materialized views and create policies
ALTER MATERIALIZED VIEW public.event_kpis_daily ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.event_scans_daily ENABLE ROW LEVEL SECURITY;
ALTER MATERIALIZED VIEW public.post_engagement_daily ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for event_kpis_daily
CREATE POLICY "event_kpis_daily_select_event_access" ON public.event_kpis_daily
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e 
      WHERE e.id = event_kpis_daily.event_id 
      AND (
        (e.owner_context_type = 'individual' AND e.owner_context_id = auth.uid()) OR
        (e.owner_context_type = 'organization' AND is_org_role(e.owner_context_id, ARRAY['viewer', 'editor', 'admin', 'owner']))
      )
    )
  );

-- Create RLS policies for event_scans_daily
CREATE POLICY "event_scans_daily_select_event_access" ON public.event_scans_daily
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e 
      WHERE e.id = event_scans_daily.event_id 
      AND (
        (e.owner_context_type = 'individual' AND e.owner_context_id = auth.uid()) OR
        (e.owner_context_type = 'organization' AND is_org_role(e.owner_context_id, ARRAY['viewer', 'editor', 'admin', 'owner']))
      )
    )
  );

-- Create RLS policies for post_engagement_daily
CREATE POLICY "post_engagement_daily_select_event_access" ON public.post_engagement_daily
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e 
      WHERE e.id = post_engagement_daily.event_id 
      AND (
        (e.owner_context_type = 'individual' AND e.owner_context_id = auth.uid()) OR
        (e.owner_context_type = 'organization' AND is_org_role(e.owner_context_id, ARRAY['viewer', 'editor', 'admin', 'owner']))
      )
    )
  );