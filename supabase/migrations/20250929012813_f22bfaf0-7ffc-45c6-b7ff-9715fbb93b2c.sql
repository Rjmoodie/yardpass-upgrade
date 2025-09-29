-- Update the event_posts_with_meta view to include viewer_has_liked
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
  -- Add viewer_has_liked column
  EXISTS(
    SELECT 1 FROM event_reactions er 
    WHERE er.post_id = p.id 
    AND er.user_id = auth.uid() 
    AND er.kind = 'like'
  ) as viewer_has_liked
FROM event_posts p
LEFT JOIN user_profiles up ON up.user_id = p.author_user_id  
JOIN events e ON e.id = p.event_id;