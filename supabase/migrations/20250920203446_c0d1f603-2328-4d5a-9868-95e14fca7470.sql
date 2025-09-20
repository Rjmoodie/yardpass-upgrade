-- Event Series Implementation
-- 1. Create enum for recurrence pattern
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recurrence_pattern') THEN
    CREATE TYPE recurrence_pattern AS ENUM ('weekly','monthly');
  END IF;
END $$;

-- 2. Event Series table
CREATE TABLE IF NOT EXISTS public.event_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  recurrence recurrence_pattern NOT NULL,
  recurrence_interval int NOT NULL DEFAULT 1,
  series_start timestamptz NOT NULL,
  series_end date NOT NULL,
  max_events int,
  timezone text NOT NULL DEFAULT 'UTC',
  template jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Add series_id to events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.event_series(id) ON DELETE SET NULL;

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS events_series_id_idx ON public.events(series_id);
CREATE INDEX IF NOT EXISTS event_series_org_idx ON public.event_series(organization_id);

-- 5. Enable RLS on event_series
ALTER TABLE public.event_series ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for event_series
CREATE POLICY "series_read_org"
ON public.event_series FOR SELECT
USING (
  EXISTS(SELECT 1 FROM public.org_memberships m
         WHERE m.org_id = event_series.organization_id
           AND m.user_id = auth.uid())
);

CREATE POLICY "series_insert_org"
ON public.event_series FOR INSERT
WITH CHECK (
  EXISTS(SELECT 1 FROM public.org_memberships m
         WHERE m.org_id = event_series.organization_id
           AND m.user_id = auth.uid()
           AND m.role IN ('editor','admin','owner'))
);

CREATE POLICY "series_update_org"
ON public.event_series FOR UPDATE
USING (
  EXISTS(SELECT 1 FROM public.org_memberships m
         WHERE m.org_id = event_series.organization_id
           AND m.user_id = auth.uid()
           AND m.role IN ('editor','admin','owner'))
);

-- 7. RPC function to create series and child events
CREATE OR REPLACE FUNCTION public.create_event_series(
  p_org_id uuid,
  p_created_by uuid,
  p_name text,
  p_description text,
  p_recurrence recurrence_pattern,
  p_interval int,
  p_series_start timestamptz,
  p_series_end date,
  p_max_events int,
  p_timezone text,
  p_template jsonb
)
RETURNS TABLE(event_id uuid, start_at timestamptz) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_series_id uuid;
  v_duration interval;
  v_cnt int := 0;
  v_start timestamptz;
  v_end   timestamptz;
  v_step interval;
BEGIN
  -- Duration from template (end_at - start_at) or fallback 2 hours
  v_duration := COALESCE(
    ((p_template->>'end_at')::timestamptz - (p_template->>'start_at')::timestamptz),
    interval '2 hours'
  );

  -- Determine step
  v_step := CASE p_recurrence
              WHEN 'weekly'  THEN make_interval(weeks => GREATEST(1,p_interval))
              WHEN 'monthly' THEN make_interval(months => GREATEST(1,p_interval))
            END;

  -- Insert series row
  INSERT INTO public.event_series(
    name, description, organization_id, created_by,
    recurrence, recurrence_interval, series_start, series_end,
    max_events, timezone, template
  ) VALUES (
    p_name, p_description, p_org_id, p_created_by,
    p_recurrence, p_interval, p_series_start, p_series_end,
    NULLIF(p_max_events,0), p_timezone, p_template
  )
  RETURNING id INTO v_series_id;

  -- Loop occurrences
  v_start := p_series_start;
  WHILE (v_start::date <= p_series_end) LOOP
    EXIT WHEN p_max_events IS NOT NULL AND v_cnt >= p_max_events;

    v_end := v_start + v_duration;

    INSERT INTO public.events(
      title, description, category, start_at, end_at, timezone,
      venue, address, city, country, lat, lng,
      cover_image_url, owner_context_type, owner_context_id,
      created_by, visibility, slug, link_token, series_id
    )
    VALUES(
      COALESCE(p_template->>'title','Untitled Event'),
      p_template->>'description',
      p_template->>'category',
      v_start, v_end, COALESCE(p_template->>'timezone', p_timezone),
      p_template->>'venue',
      p_template->>'address',
      p_template->>'city',
      p_template->>'country',
      NULLIF(p_template->>'lat','')::double precision,
      NULLIF(p_template->>'lng','')::double precision,
      p_template->>'cover_image_url',
      'organization',
      p_org_id,
      p_created_by,
      COALESCE((p_template->>'visibility')::public.event_visibility, 'public'),
      -- Basic slug generation
      regexp_replace(lower(COALESCE(p_template->>'title','untitled') || '-' || to_char(v_start, 'YYYYMMDD')), '[^a-z0-9\-]+', '-', 'g'),
      NULL,
      v_series_id
    )
    RETURNING id INTO event_id;

    start_at := v_start;
    v_cnt := v_cnt + 1;
    RETURN NEXT;

    -- Step forward
    v_start := v_start + v_step;
  END LOOP;

END $$;