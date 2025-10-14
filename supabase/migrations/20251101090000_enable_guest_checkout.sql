-- Enable guest checkout contact tracking
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

-- Backfill existing orders with user contact details when missing
UPDATE public.orders o
SET
  contact_email = COALESCE(o.contact_email, u.email),
  contact_name = COALESCE(o.contact_name, up.display_name, split_part(u.email, '@', 1)),
  contact_phone = COALESCE(o.contact_phone, up.phone)
FROM auth.users u
LEFT JOIN public.user_profiles up ON up.user_id = u.id
WHERE o.user_id = u.id
  AND (
    o.contact_email IS NULL
    OR o.contact_name IS NULL
    OR o.contact_phone IS NULL
  );

-- Refresh tickets_enhanced view with guest contact metadata
CREATE OR REPLACE VIEW public.tickets_enhanced AS
SELECT
  t.id,
  t.event_id,
  t.tier_id,
  t.order_id,
  t.owner_user_id,
  t.status,
  t.qr_code,
  t.wallet_pass_url,
  t.redeemed_at,
  t.created_at,
  e.title AS event_title,
  e.start_at AS event_date,
  e.start_at::time AS event_time,
  COALESCE(e.venue, e.address, e.city) AS event_location,
  up.display_name AS organizer_name,
  tt.price_cents / 100.0 AS price,
  COALESCE(tt.badge_label, tt.name) AS badge,
  tt.name AS ticket_type,
  o.created_at AS order_date,
  e.cover_image_url AS cover_image,
  o.contact_email AS owner_email,
  o.contact_name AS owner_name,
  o.contact_phone AS owner_phone
FROM public.tickets t
JOIN public.events e ON e.id = t.event_id
JOIN public.ticket_tiers tt ON tt.id = t.tier_id
LEFT JOIN public.orders o ON o.id = t.order_id
LEFT JOIN public.user_profiles up ON up.user_id = e.created_by;

GRANT SELECT ON public.tickets_enhanced TO authenticated;
