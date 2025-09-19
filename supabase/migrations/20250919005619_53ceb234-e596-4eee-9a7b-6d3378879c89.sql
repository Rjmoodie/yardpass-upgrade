-- Create recommendation system infrastructure (with existence checks)

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

-- Create indexes for performance (with IF NOT EXISTS checks)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_interactions_user_id') THEN
        CREATE INDEX idx_user_interactions_user_id ON public.user_event_interactions(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_interactions_event_id') THEN
        CREATE INDEX idx_user_interactions_event_id ON public.user_event_interactions(event_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_interactions_type') THEN
        CREATE INDEX idx_user_interactions_type ON public.user_event_interactions(interaction_type);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_interactions_created_at') THEN
        CREATE INDEX idx_user_interactions_created_at ON public.user_event_interactions(created_at);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_embeddings_updated_at') THEN
        CREATE INDEX idx_user_embeddings_updated_at ON public.user_embeddings(updated_at);
    END IF;
END
$$;

-- Enable RLS
ALTER TABLE public.user_event_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_embeddings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DO $$
BEGIN
    -- Drop policies for user_event_interactions
    DROP POLICY IF EXISTS "Users can insert their own interactions" ON public.user_event_interactions;
    DROP POLICY IF EXISTS "Users can view their own interactions" ON public.user_event_interactions;
    DROP POLICY IF EXISTS "Event managers can view interactions for their events" ON public.user_event_interactions;
    
    -- Drop policies for user_embeddings
    DROP POLICY IF EXISTS "Users can view their own embeddings" ON public.user_embeddings;
    DROP POLICY IF EXISTS "System can manage embeddings" ON public.user_embeddings;
END
$$;

-- Create RLS Policies for user_event_interactions
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

-- Create RLS Policies for user_embeddings
CREATE POLICY "Users can view their own embeddings" ON public.user_embeddings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage embeddings" ON public.user_embeddings
    FOR ALL USING (true) WITH CHECK (true);

-- Create materialized views (drop and recreate to ensure consistency)
DROP MATERIALIZED VIEW IF EXISTS public.user_event_affinity CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.event_covis CASCADE;

CREATE MATERIALIZED VIEW public.user_event_affinity AS
SELECT 
    ui.user_id,
    ui.event_id,
    SUM(ui.weight) as affinity_score,
    COUNT(*) as interaction_count,
    MAX(ui.created_at) as last_interaction
FROM public.user_event_interactions ui
GROUP BY ui.user_id, ui.event_id;

CREATE MATERIALIZED VIEW public.event_covis AS
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
CREATE UNIQUE INDEX idx_user_event_affinity_pk ON public.user_event_affinity(user_id, event_id);
CREATE INDEX idx_user_event_affinity_user ON public.user_event_affinity(user_id);
CREATE INDEX idx_user_event_affinity_event ON public.user_event_affinity(event_id);
CREATE INDEX idx_user_event_affinity_score ON public.user_event_affinity(affinity_score DESC);

CREATE UNIQUE INDEX idx_event_covis_pk ON public.event_covis(event_a, event_b);
CREATE INDEX idx_event_covis_a ON public.event_covis(event_a);
CREATE INDEX idx_event_covis_b ON public.event_covis(event_b);
CREATE INDEX idx_event_covis_count ON public.event_covis(covisit_count DESC);

-- Create or replace helper functions
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

CREATE OR REPLACE FUNCTION public.refresh_user_embedding(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.user_embeddings (user_id, updated_at)
    VALUES (p_user_id, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET updated_at = now();
END;
$$;

-- Create main recommendation function
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
        SELECT DISTINCT ui.event_id
        FROM public.user_event_interactions ui
        WHERE ui.user_id = p_user_id
    ),
    popular_events AS (
        SELECT 
            e.id as event_id,
            COUNT(ui.user_id) * 0.1 as popularity_score,
            'popular' as reason
        FROM public.events e
        LEFT JOIN public.user_event_interactions ui ON e.id = ui.event_id
        WHERE e.start_at > now()
            AND e.visibility = 'public'
            AND (SELECT COUNT(*) FROM user_interactions) = 0 OR e.id NOT IN (SELECT event_id FROM user_interactions)
        GROUP BY e.id
        ORDER BY COUNT(ui.user_id) DESC
        LIMIT p_limit
    )
    SELECT pe.event_id, pe.popularity_score, pe.reason
    FROM popular_events pe;
END;
$$;

-- Create similar events function
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
        e.id as event_id,
        1.0 as similarity_score
    FROM public.events e
    JOIN public.events base_event ON base_event.id = p_event_id
    WHERE e.id != p_event_id
        AND e.start_at > now()
        AND e.visibility = 'public'
        AND (e.category = base_event.category OR e.city = base_event.city)
    ORDER BY 
        CASE WHEN e.category = base_event.category THEN 2 ELSE 0 END +
        CASE WHEN e.city = base_event.city THEN 1 ELSE 0 END DESC
    LIMIT p_limit;
END;
$$;