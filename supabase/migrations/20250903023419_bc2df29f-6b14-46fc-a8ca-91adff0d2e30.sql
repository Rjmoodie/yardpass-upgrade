-- Fix function search paths for security
CREATE OR REPLACE FUNCTION public.mark_event_completed()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mark event as completed when end_at is in the past
  IF NEW.end_at < NOW() AND OLD.completed_at IS NULL THEN
    NEW.completed_at = NOW();
    
    -- Check if organizer should get pro upgrade (25+ completed events)
    IF (SELECT COUNT(*) FROM events 
        WHERE created_by = NEW.created_by 
        AND completed_at IS NOT NULL) >= 25 THEN
      
      -- Update user profile to pro status
      UPDATE user_profiles 
      SET verification_status = 'pro'
      WHERE user_id = NEW.created_by 
      AND verification_status != 'pro';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_earned_badges(p_user_id UUID)
RETURNS TABLE (
  badge_name TEXT,
  event_count INTEGER,
  description TEXT
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tt.badge_label as badge_name,
    COUNT(*)::INTEGER as event_count,
    CASE 
      WHEN tt.badge_label = 'VIP' THEN 'VIP tier attendee'
      WHEN tt.badge_label = 'EARLY' THEN 'Early bird ticket holder'
      ELSE 'Event enthusiast'
    END as description
  FROM tickets t
  JOIN ticket_tiers tt ON tt.id = t.tier_id
  WHERE t.owner_user_id = p_user_id
    AND t.status IN ('issued', 'transferred', 'redeemed')
  GROUP BY tt.badge_label;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_org_analytics(p_org_id UUID)
RETURNS TABLE (
  total_events INTEGER,
  total_revenue NUMERIC,
  total_attendees INTEGER,
  completed_events INTEGER
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(e.id)::INTEGER as total_events,
    COALESCE(SUM(o.total_cents), 0)::NUMERIC / 100 as total_revenue,
    COUNT(DISTINCT t.owner_user_id)::INTEGER as total_attendees,
    COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END)::INTEGER as completed_events
  FROM events e
  LEFT JOIN orders o ON o.event_id = e.id AND o.status = 'paid'
  LEFT JOIN tickets t ON t.event_id = e.id
  WHERE e.owner_context_type = 'organization' 
    AND e.owner_context_id = p_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_analytics(p_user_id UUID)
RETURNS TABLE (
  total_events INTEGER,
  total_revenue NUMERIC,
  total_attendees INTEGER,
  completed_events INTEGER
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(e.id)::INTEGER as total_events,
    COALESCE(SUM(o.total_cents), 0)::NUMERIC / 100 as total_revenue,
    COUNT(DISTINCT t.owner_user_id)::INTEGER as total_attendees,
    COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END)::INTEGER as completed_events
  FROM events e
  LEFT JOIN orders o ON o.event_id = e.id AND o.status = 'paid'
  LEFT JOIN tickets t ON t.event_id = e.id
  WHERE e.owner_context_type = 'individual' 
    AND e.owner_context_id = p_user_id;
END;
$$;