-- 007_views_posts_ready.sql
BEGIN;

CREATE OR REPLACE VIEW public.v_posts_ready AS
SELECT p.*
FROM public.event_posts p
LEFT JOIN LATERAL (
  SELECT bool_and(ma.status = 'ready') AS all_ready
  FROM public.post_media pm
  JOIN public.media_assets ma ON ma.id = pm.media_id
  WHERE pm.post_id = p.id
) m ON TRUE
WHERE (m.all_ready IS NULL OR m.all_ready = TRUE)
  AND (p.deleted_at IS NULL)
  AND p.moderation_state <> 'removed';

COMMIT;
