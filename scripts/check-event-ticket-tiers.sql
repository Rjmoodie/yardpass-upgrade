-- Diagnostic script to check ticket tiers for an event
-- Replace 'YOUR_EVENT_ID' with the actual event ID or slug

-- Option 1: Check by event title (matches "Liventix Official Event!")
SELECT 
  e.id as event_id,
  e.title,
  e.slug,
  COUNT(tt.id) as tier_count,
  SUM(tt.quantity) as total_capacity,
  SUM(tt.reserved_quantity) as total_reserved,
  SUM(tt.issued_quantity) as total_issued,
  SUM(tt.quantity - tt.reserved_quantity - tt.issued_quantity) as total_available
FROM events.events e
LEFT JOIN ticketing.ticket_tiers tt ON tt.event_id = e.id
WHERE e.title = 'Liventix Official Event!'
GROUP BY e.id, e.title, e.slug
ORDER BY e.created_at DESC;

-- Option 2: Check actual ticket tiers (if event ID is known)
-- Replace 'YOUR_EVENT_ID' with the actual event ID
/*
SELECT 
  tt.id,
  tt.name,
  tt.price_cents,
  tt.quantity as total_capacity,
  tt.reserved_quantity,
  tt.issued_quantity,
  (tt.quantity - tt.reserved_quantity - tt.issued_quantity) as available,
  tt.status,
  tt.tier_visibility
FROM ticketing.ticket_tiers tt
WHERE tt.event_id = 'YOUR_EVENT_ID'
ORDER BY tt.price_cents ASC;
*/

-- Option 3: Check public view access (simulating frontend query)
/*
SELECT 
  id,
  name,
  price_cents,
  quantity,
  reserved_quantity,
  issued_quantity
FROM public.ticket_tiers
WHERE event_id = 'YOUR_EVENT_ID'
ORDER BY price_cents ASC;
*/

