-- ============================================
-- DATABASE DEBUGGING QUERIES
-- Run these in Supabase SQL Editor
-- ============================================

-- 1. Check the last ticket purchase (most recent)
-- This shows if tickets are being created at all
SELECT 
  t.id AS ticket_id,
  t.qr_code,
  t.serial_no,
  t.order_id,
  t.owner_user_id,
  t.status,
  t.created_at,
  tt.name AS tier_name,
  e.title AS event_title
FROM tickets t
LEFT JOIN ticket_tiers tt ON t.tier_id = tt.id
LEFT JOIN events e ON t.event_id = e.id
ORDER BY t.created_at DESC
LIMIT 5;

-- 2. Check the last order (to see what's being created)
SELECT 
  o.id AS order_id,
  o.user_id,
  o.event_id,
  o.status,
  o.total_cents,
  o.contact_email,
  o.contact_name,
  o.stripe_session_id,
  o.created_at,
  o.paid_at,
  e.title AS event_title
FROM orders o
LEFT JOIN events e ON o.event_id = e.id
ORDER BY o.created_at DESC
LIMIT 5;

-- 3. Check if tickets are linked to orders properly
-- This is the KEY query - if this returns nothing, that's your problem!
SELECT 
  o.id AS order_id,
  o.status AS order_status,
  o.contact_email,
  o.created_at AS order_created,
  COUNT(t.id) AS ticket_count,
  ARRAY_AGG(t.id) AS ticket_ids,
  ARRAY_AGG(t.qr_code) AS qr_codes
FROM orders o
LEFT JOIN tickets t ON t.order_id = o.id
WHERE o.created_at > NOW() - INTERVAL '24 hours'
GROUP BY o.id, o.status, o.contact_email, o.created_at
ORDER BY o.created_at DESC
LIMIT 5;

-- 4. Check if there are orders WITHOUT tickets (orphaned orders)
-- If this returns rows, tickets aren't being created!
SELECT 
  o.id AS order_id,
  o.status,
  o.contact_email,
  o.created_at,
  COUNT(t.id) AS ticket_count
FROM orders o
LEFT JOIN tickets t ON t.order_id = o.id
WHERE o.created_at > NOW() - INTERVAL '24 hours'
GROUP BY o.id, o.status, o.contact_email, o.created_at
HAVING COUNT(t.id) = 0
ORDER BY o.created_at DESC;

-- 5. Check a specific order's tickets (replace 'your-order-id' with actual ID from logs)
-- Use this after you know the order_id from a test purchase
SELECT 
  t.id,
  t.qr_code,
  t.order_id,
  t.created_at
FROM tickets t
WHERE t.order_id = 'your-order-id-here';

-- 6. Check what data is in the orders table structure
-- This helps verify if the schema matches what we expect
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'tickets'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Check if order_id exists in tickets table
-- This verifies the relationship exists
SELECT EXISTS (
  SELECT 1 
  FROM information_schema.columns 
  WHERE table_name = 'tickets' 
    AND column_name = 'order_id'
    AND table_schema = 'public'
) AS order_id_column_exists;

-- ============================================
-- EXPECTED RESULTS:
-- ============================================
-- Query 1: Should show recent tickets with QR codes
-- Query 2: Should show recent orders
-- Query 3: Should show orders WITH ticket_count > 0
-- Query 4: Should return NO ROWS (if it returns rows, tickets aren't being created!)
-- Query 5: Should return tickets for that specific order
-- Query 6: Should show all columns in tickets table
-- Query 7: Should return TRUE

