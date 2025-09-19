-- Create recommendation system tables and infrastructure
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create user_event_interactions table
CREATE TABLE IF NOT EXISTS public.user_event_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('event_view', 'video_watch', 'like', 'comment', 'share', 'ticket_open', 'ticket_purchase')),
    weight INTEGER NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_embeddings table
CREATE TABLE IF NOT EXISTS public.user_embeddings (
    user_id UUID PRIMARY KEY,
    embedding vector(384),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_interactions_user_id ON public.user_event_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_event_id ON public.user_event_interactions(event_id);
CREATE INDEX IF NOT EXISTS idx_user_interactions_type ON public.user_event_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_user_interactions_created_at ON public.user_event_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_user_embeddings_updated_at ON public.user_embeddings(updated_at);

-- Enable RLS
ALTER TABLE public.user_event_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_event_interactions
CREATE POLICY "Users can insert their own interactions" ON public.user_event_interactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own interactions" ON public.user_event_interactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Event managers can view interactions for their events" ON public.user_event_interactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.events e 
            WHERE e.id = event_id AND is_event_manager(e.id)
        )
    );

-- RLS Policies for user_embeddings
CREATE POLICY "Users can view their own embeddings" ON public.user_embeddings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage embeddings" ON public.user_embeddings
    FOR ALL USING (true) WITH CHECK (true);

-- Create materialized view for user-event affinity
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_event_affinity AS
SELECT 
    ui.user_id,
    ui.event_id,
    SUM(ui.weight) as affinity_score,
    COUNT(*) as interaction_count,
    MAX(ui.created_at) as last_interaction
FROM public.user_event_interactions ui
GROUP BY ui.user_id, ui.event_id;

-- Create materialized view for event co-visitation
CREATE MATERIALIZED VIEW IF NOT EXISTS public.event_covis AS
SELECT 
    e1.event_id as event_a,
    e2.event_id as event_b,
    COUNT(DISTINCT e1.user_id) as covisit_count,
    COUNT(DISTINCT e1.user_id) * 1.0 / NULLIF(
        (SELECT COUNT(DISTINCT user_id) FROM public.user_event_interactions WHERE event_id = e1.event_id), 0
    ) as covisit_ratio
FROM public.user_event_interactions e1
JOIN public.user_event_interactions e2 ON e1.user_id = e2.user_id AND e1.event_id != e2.event_id
GROUP BY e1.event_id, e2.event_id
HAVING COUNT(DISTINCT e1.user_id) >= 2;

-- Create indexes on materialized views
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_event_affinity_pk ON public.user_event_affinity(user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_user_event_affinity_user ON public.user_event_affinity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_event_affinity_event ON public.user_event_affinity(event_id);
CREATE INDEX IF NOT EXISTS idx_user_event_affinity_score ON public.user_event_affinity(affinity_score DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_covis_pk ON public.event_covis(event_a, event_b);
CREATE INDEX IF NOT EXISTS idx_event_covis_a ON public.event_covis(event_a);
CREATE INDEX IF NOT EXISTS idx_event_covis_b ON public.event_covis(event_b);
CREATE INDEX IF NOT EXISTS idx_event_covis_count ON public.event_covis(covisit_count DESC);

-- Function to refresh user affinity
CREATE OR REPLACE FUNCTION public.refresh_user_affinity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_event_affinity;
EXCEPTION WHEN feature_not_supported THEN
    REFRESH MATERIALIZED VIEW public.user_event_affinity;
END;
$$;

-- Function to refresh event covisitation
CREATE OR REPLACE FUNCTION public.refresh_covis()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.event_covis;
EXCEPTION WHEN feature_not_supported THEN
    REFRESH MATERIALIZED VIEW public.event_covis;
END;
$$;

-- Function to refresh user embedding
CREATE OR REPLACE FUNCTION public.refresh_user_embedding(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- This will be called by the edge function to update embeddings
    -- For now, just update the timestamp
    INSERT INTO public.user_embeddings (user_id, updated_at)
    VALUES (p_user_id, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET updated_at = now();
END;
$$;

-- Main recommendation function
CREATE OR REPLACE FUNCTION public.get_recommendations(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    event_id UUID,
    score NUMERIC,
    reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH user_interactions AS (
        -- Get user's past interactions
        SELECT DISTINCT ui.event_id
        FROM public.user_event_interactions ui
        WHERE ui.user_id = p_user_id
    ),
    collaborative_scores AS (
        -- Collaborative filtering based on similar users
        SELECT 
            ua2.event_id,
            AVG(ua2.affinity_score) as collab_score,
            'collaborative' as reason
        FROM public.user_event_affinity ua1
        JOIN public.user_event_affinity ua2 ON ua1.event_id = ua2.event_id
        WHERE ua1.user_id = p_user_id
            AND ua2.user_id != p_user_id
            AND ua2.event_id NOT IN (SELECT event_id FROM user_interactions)
        GROUP BY ua2.event_id
        HAVING COUNT(*) >= 2
    ),
    content_scores AS (
        -- Content-based filtering using co-visitation
        SELECT 
            ec.event_b as event_id,
            AVG(ec.covisit_ratio * ua.affinity_score) as content_score,
            'content-based' as reason
        FROM user_interactions ui
        JOIN public.event_covis ec ON ui.event_id = ec.event_a
        JOIN public.user_event_affinity ua ON ua.event_id = ui.event_id AND ua.user_id = p_user_id
        WHERE ec.event_b NOT IN (SELECT event_id FROM user_interactions)
        GROUP BY ec.event_b
    ),
    popular_scores AS (
        -- Popular events for cold start
        SELECT 
            e.id as event_id,
            COUNT(ui.user_id) * 0.1 as popularity_score,
            'popular' as reason
        FROM public.events e
        LEFT JOIN public.user_event_interactions ui ON e.id = ui.event_id
        WHERE e.id NOT IN (SELECT event_id FROM user_interactions)
            AND e.start_at > now()
            AND e.visibility = 'public'
        GROUP BY e.id
        HAVING COUNT(ui.user_id) > 0
    ),
    all_recommendations AS (
        SELECT event_id, collab_score as score, reason FROM collaborative_scores
        UNION ALL
        SELECT event_id, content_score as score, reason FROM content_scores
        UNION ALL
        SELECT event_id, popularity_score as score, reason FROM popular_scores
    ),
    final_scores AS (
        SELECT 
            ar.event_id,
            SUM(ar.score) as final_score,
            STRING_AGG(DISTINCT ar.reason, ', ') as combined_reason
        FROM all_recommendations ar
        JOIN public.events e ON ar.event_id = e.id
        WHERE e.start_at > now() -- Only future events
            AND e.visibility = 'public'
        GROUP BY ar.event_id
    )
    SELECT 
        fs.event_id,
        fs.final_score,
        fs.combined_reason
    FROM final_scores fs
    ORDER BY fs.final_score DESC
    LIMIT p_limit;
END;
$$;

-- Similar events function
CREATE OR REPLACE FUNCTION public.similar_events(
    p_event_id UUID,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE(
    event_id UUID,
    similarity_score NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ec.event_b as event_id,
        ec.covisit_ratio as similarity_score
    FROM public.event_covis ec
    JOIN public.events e ON ec.event_b = e.id
    WHERE ec.event_a = p_event_id
        AND e.start_at > now()
        AND e.visibility = 'public'
    ORDER BY ec.covisit_ratio DESC
    LIMIT p_limit;
END;
$$;