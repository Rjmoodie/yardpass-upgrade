-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('event-media', 'event-media', true),
  ('user-avatars', 'user-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for event media
CREATE POLICY "Event media is publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'event-media');

CREATE POLICY "Users can upload event media" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'event-media' AND auth.uid() IS NOT NULL);

-- Create storage policies for user avatars
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'user-avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add event completion tracking
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Create function to mark event as completed
CREATE OR REPLACE FUNCTION public.mark_event_completed()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for event completion
DROP TRIGGER IF EXISTS trg_mark_event_completed ON public.events;
CREATE TRIGGER trg_mark_event_completed
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_event_completed();

-- Create function to get user's earned badges
CREATE OR REPLACE FUNCTION public.get_user_earned_badges(p_user_id UUID)
RETURNS TABLE (
  badge_name TEXT,
  event_count INTEGER,
  description TEXT
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get organization events analytics
CREATE OR REPLACE FUNCTION public.get_org_analytics(p_org_id UUID)
RETURNS TABLE (
  total_events INTEGER,
  total_revenue NUMERIC,
  total_attendees INTEGER,
  completed_events INTEGER
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get individual user analytics  
CREATE OR REPLACE FUNCTION public.get_user_analytics(p_user_id UUID)
RETURNS TABLE (
  total_events INTEGER,
  total_revenue NUMERIC,
  total_attendees INTEGER,
  completed_events INTEGER
) AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;