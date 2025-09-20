-- Fix ambiguous column reference in get_recommendations function
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
            AND ((SELECT COUNT(*) FROM user_interactions) = 0 OR e.id NOT IN (SELECT ui_inner.event_id FROM user_interactions ui_inner))
        GROUP BY e.id
        ORDER BY COUNT(ui.user_id) DESC
        LIMIT p_limit
    )
    SELECT pe.event_id, pe.popularity_score, pe.reason
    FROM popular_events pe;
END;
$$;