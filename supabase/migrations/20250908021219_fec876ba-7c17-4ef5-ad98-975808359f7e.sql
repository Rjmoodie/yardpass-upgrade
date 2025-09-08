-- Update the event_posts_with_meta view to use our new badge function
CREATE OR REPLACE VIEW event_posts_with_meta AS
SELECT 
  ep.id,
  ep.event_id,
  ep.text,
  ep.media_urls,
  ep.created_at,
  ep.updated_at,
  ep.author_user_id,
  ep.like_count,
  ep.comment_count,
  ep.deleted_at,
  ep.ticket_tier_id,
  up.display_name as author_name,
  up.photo_url as author_photo_url,
  e.title as event_title,
  -- Check if user is organizer
  CASE 
    WHEN e.created_by = ep.author_user_id THEN true
    WHEN e.owner_context_type = 'individual' AND e.owner_context_id = ep.author_user_id THEN true
    WHEN e.owner_context_type = 'organization' AND EXISTS (
      SELECT 1 FROM org_memberships om 
      WHERE om.org_id = e.owner_context_id 
        AND om.user_id = ep.author_user_id 
        AND om.role IN ('owner', 'admin', 'editor')
    ) THEN true
    ELSE false
  END as author_is_organizer,
  -- Get user's highest tier badge for this event (only if not organizer)
  CASE 
    WHEN e.created_by = ep.author_user_id THEN null
    WHEN e.owner_context_type = 'individual' AND e.owner_context_id = ep.author_user_id THEN null
    WHEN e.owner_context_type = 'organization' AND EXISTS (
      SELECT 1 FROM org_memberships om 
      WHERE om.org_id = e.owner_context_id 
        AND om.user_id = ep.author_user_id 
        AND om.role IN ('owner', 'admin', 'editor')
    ) THEN null
    ELSE get_user_highest_tier_badge(ep.author_user_id, ep.event_id)
  END as author_badge_label
FROM event_posts ep
LEFT JOIN user_profiles up ON up.user_id = ep.author_user_id
LEFT JOIN events e ON e.id = ep.event_id
WHERE ep.deleted_at IS NULL;