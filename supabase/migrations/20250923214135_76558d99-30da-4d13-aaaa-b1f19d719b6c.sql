-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the ticket expiry daemon to run every 5 minutes
SELECT cron.schedule(
  'expire-ticket-holds',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/ticket-expiry-daemon',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- Schedule inventory monitoring to run every 10 minutes
SELECT cron.schedule(
  'monitor-inventory',
  '*/10 * * * *', -- Every 10 minutes
  $$
  SELECT net.http_post(
    url := 'https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/inventory-monitor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZXNseG5yZmVxY2hiY21nYXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MjY2NzgsImV4cCI6MjA3MjQwMjY3OH0.SZBbXL9fWSvm-u6Y3TptViQNrv5lnYe-SiRPdNeV2LY"}'::jsonb,
    body := '{"source": "cron"}'::jsonb
  );
  $$
);

-- Add hold_ids column to orders table to track associated holds
ALTER TABLE orders ADD COLUMN IF NOT EXISTS hold_ids UUID[] DEFAULT '{}';

-- Create index for faster hold cleanup
CREATE INDEX IF NOT EXISTS idx_ticket_holds_expiry ON ticket_holds(status, expires_at) WHERE status = 'active';

-- Create index for inventory monitoring
CREATE INDEX IF NOT EXISTS idx_ticket_tiers_inventory ON ticket_tiers(total_quantity, reserved_quantity, issued_quantity);

-- Add helper function to get inventory health
CREATE OR REPLACE FUNCTION get_inventory_health()
RETURNS TABLE(
  tier_id UUID,
  tier_name TEXT,
  event_id UUID,
  total_quantity INTEGER,
  reserved_quantity INTEGER,
  issued_quantity INTEGER,
  available INTEGER,
  health_status TEXT
) 
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT 
    tt.id as tier_id,
    tt.name as tier_name,
    tt.event_id,
    tt.total_quantity,
    tt.reserved_quantity,
    tt.issued_quantity,
    (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) as available,
    CASE 
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) < 0 THEN 'OVERSOLD'
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) = 0 THEN 'SOLD_OUT'
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) <= 5 THEN 'LOW_INVENTORY'
      ELSE 'HEALTHY'
    END as health_status
  FROM ticket_tiers tt
  WHERE tt.status = 'active'
  ORDER BY 
    CASE 
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) < 0 THEN 1
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) = 0 THEN 2
      WHEN (tt.total_quantity - tt.reserved_quantity - tt.issued_quantity) <= 5 THEN 3
      ELSE 4
    END,
    tt.event_id, tt.name;
$$;