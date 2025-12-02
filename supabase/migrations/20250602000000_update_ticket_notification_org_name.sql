-- Update handle_new_ticket to show organization name instead of user name
-- For ticket purchase notifications, the organization (event host) should be shown as the sender

CREATE OR REPLACE FUNCTION public.handle_new_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event_title TEXT;
  v_tier_name TEXT;
  v_org_name TEXT;
  v_org_logo TEXT;
  v_owner_context_type TEXT;
  v_owner_context_id UUID;
BEGIN
  -- Guard: No owner
  IF NEW.owner_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get event info from events.events (including owner context)
  SELECT title, owner_context_type, owner_context_id 
  INTO v_event_title, v_owner_context_type, v_owner_context_id
  FROM events.events
  WHERE id = NEW.event_id;

  IF v_event_title IS NULL THEN
    v_event_title := 'the event';
  END IF;

  -- Get tier info from ticketing.ticket_tiers
  -- Column is tier_id in ticketing.tickets table
  SELECT name INTO v_tier_name
  FROM ticketing.ticket_tiers
  WHERE id = NEW.tier_id;

  IF v_tier_name IS NULL THEN
    v_tier_name := 'ticket';
  END IF;

  -- Get organization info if event is owned by an organization
  IF v_owner_context_type = 'organization' AND v_owner_context_id IS NOT NULL THEN
    SELECT name, logo_url INTO v_org_name, v_org_logo
    FROM public.organizations
    WHERE id = v_owner_context_id;
  END IF;

  -- Create notification with organization name (if available) or fallback to Liventix
  PERFORM public.create_notification(
    p_user_id := NEW.owner_user_id,
    p_title := 'Ticket Confirmed! 🎫',
    p_message := format('Your %s ticket for %s is ready', v_tier_name, v_event_title),
    p_type := 'success',
    p_event_type := 'ticket_purchase',
    p_action_url := '/tickets',
    p_data := jsonb_build_object(
      'target_ticket_id', NEW.id,
      'target_event_id', NEW.event_id,
      'target_event_title', v_event_title,
      'target_tier_name', v_tier_name,
      'org_name', COALESCE(v_org_name, 'Liventix'),
      'org_logo', COALESCE(v_org_logo, ''),
      'org_id', v_owner_context_id,
      'user_id', NEW.owner_user_id
    )
  );

  RETURN NEW;
END;
$$;

