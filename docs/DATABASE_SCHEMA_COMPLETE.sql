-- ============================================================
-- 📦 Yardpass Sponsorship Wing - Authoritative Schema Snapshot
-- ============================================================
-- Generated for implementers wiring the sponsorship wing end-to-end.
-- Contains only the tables, views, functions, and policies required
-- for the workspace, widget, and command center subsystems.
-- ============================================================

-- 1. Core Sponsorship Entities --------------------------------
CREATE TABLE IF NOT EXISTS public.sponsorship_workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    settings jsonb DEFAULT '{}'::jsonb,
    default_role text NOT NULL DEFAULT 'viewer',
    goal_gmv_cents bigint,
    reporting_webhook text,
    created_by uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS public.sponsorship_workspace_members (
    workspace_id uuid NOT NULL REFERENCES public.sponsorship_workspaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'manager', 'analyst', 'viewer')),
    joined_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz,
    invitation_state text NOT NULL DEFAULT 'accepted',
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.sponsorship_widget_registry (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES public.sponsorship_workspaces(id) ON DELETE CASCADE,
    package_id uuid REFERENCES public.sponsorship_packages(id) ON DELETE SET NULL,
    widget_type text NOT NULL,
    config jsonb NOT NULL,
    ordering integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_by uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, id)
);

-- 2. Command Center Telemetry ----------------------------------
CREATE TABLE IF NOT EXISTS public.sponsorship_command_center_feed (
    id bigserial PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.sponsorship_workspaces(id) ON DELETE CASCADE,
    collected_at timestamptz NOT NULL DEFAULT now(),
    metrics jsonb NOT NULL,
    alerts jsonb DEFAULT '[]'::jsonb,
    ingestion_source text NOT NULL DEFAULT 'rollup',
    UNIQUE (workspace_id, collected_at)
);

CREATE TABLE IF NOT EXISTS public.sponsorship_workspace_audit (
    id bigserial PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.sponsorship_workspaces(id) ON DELETE CASCADE,
    actor_id uuid REFERENCES auth.users(id),
    action text NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Views ------------------------------------------------------
CREATE OR REPLACE VIEW public.v_sponsorship_workspace_widgets AS
SELECT
    r.id AS widget_id,
    r.workspace_id,
    r.widget_type,
    r.package_id,
    r.config,
    r.is_active,
    r.ordering,
    p.title AS package_title,
    p.tier,
    p.price_cents,
    p.quality_score,
    p.inventory,
    p.sold
FROM public.sponsorship_widget_registry r
LEFT JOIN public.sponsorship_packages p ON p.id = r.package_id
WHERE r.is_active = true;

CREATE OR REPLACE VIEW public.v_sponsorship_command_center_daily AS
SELECT
    workspace_id,
    date_trunc('day', collected_at) AS day,
    jsonb_build_object(
        'gmv_cents', SUM((metrics->>'gmv_cents')::bigint),
        'active_packages', MAX((metrics->>'active_packages')::int),
        'win_rate', AVG((metrics->>'win_rate')::numeric)
    ) AS aggregates,
    jsonb_agg(alerts) FILTER (WHERE alerts <> '[]'::jsonb) AS alert_history
FROM public.sponsorship_command_center_feed
GROUP BY 1, 2
ORDER BY day DESC;

-- 4. Functions --------------------------------------------------
CREATE OR REPLACE FUNCTION public.enable_sponsorship_command_center(
    workspace_id uuid,
    capture_rollups boolean DEFAULT true,
    notify_slack_webhook text DEFAULT NULL
) RETURNS void AS $$
BEGIN
    INSERT INTO public.sponsorship_workspace_audit (workspace_id, action, payload)
    VALUES (workspace_id, 'command_center.enabled', jsonb_build_object(
        'capture_rollups', capture_rollups,
        'notify_slack_webhook', notify_slack_webhook
    ));

    IF capture_rollups THEN
        PERFORM cron.schedule(
            job_name := 'command-center-rollup-' || workspace_id,
            schedule := '*/5 * * * *',
            command := format('select public.refresh_command_center_metrics(''%s''::uuid);', workspace_id)
        );
    END IF;

    IF notify_slack_webhook IS NOT NULL THEN
        PERFORM public.queue_webhook_event(
            event_type => 'command_center.enabled',
            payload => jsonb_build_object('workspace_id', workspace_id, 'webhook', notify_slack_webhook)
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.refresh_workspace_widget_cache(workspace_id uuid)
RETURNS void AS $$
BEGIN
    DELETE FROM public.sponsorship_widget_cache WHERE workspace_id = refresh_workspace_widget_cache.workspace_id;
    INSERT INTO public.sponsorship_widget_cache (workspace_id, widget_id, payload)
    SELECT
        r.workspace_id,
        r.id,
        jsonb_build_object(
            'widget_type', r.widget_type,
            'config', r.config,
            'package', to_jsonb(p.*)
        )
    FROM public.sponsorship_widget_registry r
    LEFT JOIN public.sponsorship_packages p ON p.id = r.package_id
    WHERE r.workspace_id = refresh_workspace_widget_cache.workspace_id
      AND r.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Row-Level Security ----------------------------------------
ALTER TABLE public.sponsorship_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_widget_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_command_center_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsorship_workspace_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_member_access ON public.sponsorship_workspaces
USING (
    EXISTS (
        SELECT 1
        FROM public.sponsorship_workspace_members m
        WHERE m.workspace_id = sponsorship_workspaces.id
          AND m.user_id = auth.uid()
    )
);

CREATE POLICY widget_member_access ON public.sponsorship_widget_registry
USING (
    EXISTS (
        SELECT 1
        FROM public.sponsorship_workspace_members m
        WHERE m.workspace_id = sponsorship_widget_registry.workspace_id
          AND m.user_id = auth.uid()
    )
);

CREATE POLICY feed_member_access ON public.sponsorship_command_center_feed
USING (
    EXISTS (
        SELECT 1
        FROM public.sponsorship_workspace_members m
        WHERE m.workspace_id = sponsorship_command_center_feed.workspace_id
          AND m.user_id = auth.uid()
    )
);

-- 6. Supporting Indexes ----------------------------------------
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.sponsorship_workspace_members (user_id);
CREATE INDEX IF NOT EXISTS idx_widget_registry_workspace ON public.sponsorship_widget_registry (workspace_id, widget_type);
CREATE INDEX IF NOT EXISTS idx_command_center_feed_workspace_time ON public.sponsorship_command_center_feed (workspace_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_audit_workspace_time ON public.sponsorship_workspace_audit (workspace_id, created_at DESC);

-- 7. Diagnostics ------------------------------------------------
CREATE OR REPLACE VIEW public.v_sponsorship_workspace_health AS
SELECT
    w.id AS workspace_id,
    w.name,
    COUNT(DISTINCT m.user_id) AS member_count,
    COUNT(DISTINCT r.id) FILTER (WHERE r.is_active) AS active_widgets,
    MAX(f.collected_at) AS last_feed_at,
    BOOL_AND(f.collected_at > now() - interval '30 minutes') AS feed_recent,
    SUM((f.metrics->>'gmv_cents')::bigint) FILTER (WHERE f.collected_at > now() - interval '7 days') AS gmv_last_7d
FROM public.sponsorship_workspaces w
LEFT JOIN public.sponsorship_workspace_members m ON m.workspace_id = w.id
LEFT JOIN public.sponsorship_widget_registry r ON r.workspace_id = w.id
LEFT JOIN public.sponsorship_command_center_feed f ON f.workspace_id = w.id
GROUP BY 1, 2;

-- End of schema snapshot ---------------------------------------
