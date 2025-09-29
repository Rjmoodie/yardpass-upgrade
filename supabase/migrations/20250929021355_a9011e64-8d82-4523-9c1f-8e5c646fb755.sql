-- Fix the event_posts_with_meta view to properly handle viewer_has_liked
-- The issue is that auth.uid() doesn't work correctly when called via direct SQL queries
-- We need to use a different approach for the view

DROP VIEW IF EXISTS event_posts_with_meta;

CREATE VIEW event_posts_with_meta AS
SELECT 
  p.*,
  up.display_name as author_name,
  up.photo_url as author_photo_url,
  e.title as event_title,
  (p.author_user_id = e.created_by) as author_is_organizer,
  CASE 
    WHEN p.author_user_id = e.created_by THEN 'ORGANIZER'
    ELSE COALESCE(get_user_event_badge(p.author_user_id, p.event_id), 'ATTENDEE')
  END as author_badge_label,
  -- Remove viewer_has_liked from the view since auth.uid() doesn't work reliably here
  -- This will be handled client-side or via RPC functions instead
  false as viewer_has_liked
FROM event_posts p
LEFT JOIN user_profiles up ON up.user_id = p.author_user_id  
JOIN events e ON e.id = p.event_id;