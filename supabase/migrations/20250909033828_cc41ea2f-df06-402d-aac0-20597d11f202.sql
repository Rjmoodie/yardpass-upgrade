-- Add badge labels to existing ticket tiers
UPDATE ticket_tiers 
SET badge_label = 'GENERAL' 
WHERE name = 'General Admission' AND badge_label IS NULL;

UPDATE ticket_tiers 
SET badge_label = 'VIP' 
WHERE name = 'VIP' AND badge_label IS NULL;

-- Create a VIP ticket for Kaylee so she gets a badge
INSERT INTO tickets (
  event_id, 
  owner_user_id, 
  tier_id, 
  status, 
  qr_code
)
SELECT 
  e.id as event_id,
  up.user_id,
  tt.id as tier_id,
  'issued' as status,
  'KAYLEE-VIP-' || substr(gen_random_uuid()::text, 1, 8) as qr_code
FROM events e
JOIN ticket_tiers tt ON tt.event_id = e.id
JOIN user_profiles up ON up.display_name = 'Kaylee'
WHERE e.title LIKE '%Summer Music Festival%'
  AND tt.name = 'VIP'
  AND NOT EXISTS (
    SELECT 1 FROM tickets t 
    WHERE t.owner_user_id = up.user_id 
    AND t.event_id = e.id
  )
LIMIT 1;