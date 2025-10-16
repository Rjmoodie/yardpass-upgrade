-- Debug Guest Access System
-- Check if guest-related tables exist and have data

-- 1. Check guest_otp_codes table
SELECT 
  'guest_otp_codes' as table_name,
  COUNT(*) as record_count,
  MIN(created_at) as earliest_record,
  MAX(created_at) as latest_record
FROM guest_otp_codes
WHERE expires_at > NOW();

-- 2. Check guest_ticket_sessions table  
SELECT 
  'guest_ticket_sessions' as table_name,
  COUNT(*) as record_count,
  MIN(created_at) as earliest_record,
  MAX(created_at) as latest_record
FROM guest_ticket_sessions
WHERE expires_at > NOW();

-- 3. Check rate_limits table for guest OTP
SELECT 
  'rate_limits' as table_name,
  COUNT(*) as record_count,
  bucket,
  MIN(minute) as earliest,
  MAX(minute) as latest
FROM rate_limits 
WHERE bucket LIKE 'guest-otp:%'
GROUP BY bucket;

-- 4. Check tickets_enhanced view (used by tickets-list-guest)
SELECT 
  'tickets_enhanced' as table_name,
  COUNT(*) as record_count,
  COUNT(CASE WHEN owner_email IS NOT NULL THEN 1 END) as with_email,
  COUNT(CASE WHEN owner_phone IS NOT NULL THEN 1 END) as with_phone
FROM tickets_enhanced;

-- 5. Sample guest ticket data
SELECT 
  id,
  event_title,
  owner_email,
  owner_phone,
  status,
  created_at
FROM tickets_enhanced 
WHERE owner_email IS NOT NULL OR owner_phone IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
