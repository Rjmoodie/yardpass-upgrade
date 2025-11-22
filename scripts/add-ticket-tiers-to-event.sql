-- Script to add ticket tiers to an existing event
-- Replace 'YOUR_EVENT_ID' with the actual event ID: 28309929-28e7-4bda-af28-6e0b47485ce1

-- Example: Add a General Admission tier ($0 - Free)
INSERT INTO ticketing.ticket_tiers (
  event_id,
  name,
  price_cents,
  quantity,
  total_quantity,
  badge_label,
  currency,
  status,
  fee_bearer,
  tier_visibility,
  sort_index,
  is_rsvp_only,
  reserved_quantity,
  issued_quantity
) VALUES (
  '28309929-28e7-4bda-af28-6e0b47485ce1',  -- Event ID
  'General Admission',                      -- Tier name
  0,                                        -- Free tier ($0.00)
  100,                                      -- Total capacity
  100,                                      -- total_quantity (same as quantity)
  'GA',                                     -- Badge label
  'USD',                                    -- Currency
  'active',                                 -- Status: active, sold_out, paused
  'organizer',                              -- Fee bearer: customer or organizer
  'visible',                                -- Visibility: visible, hidden, secret
  1,                                        -- Sort order (1 = first)
  false,                                    -- is_rsvp_only: false = tickets issued, true = RSVP only
  0,                                        -- reserved_quantity (initially 0)
  0                                         -- issued_quantity (initially 0)
);

-- Example: Add a VIP tier ($50.00)
/*
INSERT INTO ticketing.ticket_tiers (
  event_id,
  name,
  price_cents,
  quantity,
  total_quantity,
  badge_label,
  currency,
  status,
  fee_bearer,
  tier_visibility,
  sort_index,
  is_rsvp_only,
  reserved_quantity,
  issued_quantity
) VALUES (
  '28309929-28e7-4bda-af28-6e0b47485ce1',
  'VIP',
  5000,  -- $50.00 in cents
  50,
  50,
  'VIP',
  'USD',
  'active',
  'organizer',
  'visible',
  2,
  false,
  0,
  0
);
*/

-- Verify the tiers were added
SELECT 
  id,
  name,
  price_cents,
  (price_cents / 100.0) as price_dollars,
  quantity,
  badge_label,
  status,
  tier_visibility
FROM ticketing.ticket_tiers
WHERE event_id = '28309929-28e7-4bda-af28-6e0b47485ce1'
ORDER BY sort_index ASC;

