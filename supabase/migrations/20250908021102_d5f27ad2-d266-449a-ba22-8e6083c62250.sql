-- First, let's check if the function already exists and create it properly
CREATE OR REPLACE FUNCTION get_user_highest_tier_badge(user_id_param uuid, event_id_param uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tt.badge_label
  FROM tickets t
  JOIN ticket_tiers tt ON t.tier_id = tt.id
  WHERE t.owner_user_id = user_id_param 
    AND t.event_id = event_id_param
    AND t.status IN ('issued', 'transferred', 'redeemed')
    AND tt.badge_label IS NOT NULL
  ORDER BY tt.price_cents DESC
  LIMIT 1;
$$;