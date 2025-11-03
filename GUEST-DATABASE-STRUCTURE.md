# 🗄️ Guest Database Structure

## 📊 **Database Tables for Guest Access**

### **1. `ticketing.guest_otp_codes`**
**Purpose**: Stores one-time passwords for guest verification

**Schema**:
```sql
CREATE TABLE ticketing.guest_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  method TEXT NOT NULL,              -- 'email' or 'phone'
  contact TEXT NOT NULL,              -- Email address or phone number
  otp_hash TEXT NOT NULL,             -- SHA-256 hash of OTP code
  event_id UUID REFERENCES public.events(id),  -- Optional event scope
  expires_at TIMESTAMPTZ NOT NULL,    -- 5 minutes from creation
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

**Indexed Fields**:
- `method` + `contact` (for lookup)
- `expires_at` (for cleanup)

**Lifecycle**:
- Created when guest requests OTP code
- Valid for 5 minutes
- Deleted after successful verification
- Automatically cleaned up by TTL

---

### **2. `ticketing.guest_ticket_sessions`**
**Purpose**: Stores active guest sessions after OTP verification

**Schema**:
```sql
CREATE TABLE ticketing.guest_ticket_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,    -- SHA-256 hash of session token
  method TEXT NOT NULL,                -- 'email' or 'phone'
  contact TEXT NOT NULL,               -- Email or phone used
  scope JSONB,                         -- { all: true } or { eventIds: [...] }
  expires_at TIMESTAMPTZ NOT NULL,     -- 30-45 minutes from creation
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

**Indexed Fields**:
- `token_hash` (unique, for fast lookup)
- `contact` + `method` (for duplicate prevention)
- `expires_at` (for cleanup)

**Scope Types**:
```json
// All events
{ "all": true }

// Specific events only
{ "eventIds": ["uuid1", "uuid2", ...] }
```

**Lifecycle**:
- Created after OTP verification
- Valid for 30-45 minutes
- Used by `tickets-list-guest` to fetch tickets
- Can be extended by re-verifying

---

### **3. `public.guest_otp_codes` (VIEW)**
**Purpose**: Exposes `ticketing.guest_otp_codes` to Edge Functions

**Why Needed**: PostgREST only exposes `public` schema to API/Edge Functions

```sql
CREATE OR REPLACE VIEW public.guest_otp_codes AS
SELECT * FROM ticketing.guest_otp_codes;

GRANT ALL ON public.guest_otp_codes TO service_role;
ALTER VIEW public.guest_otp_codes SET (security_invoker = on);
```

---

### **4. `public.guest_ticket_sessions` (VIEW)**
**Purpose**: Exposes `ticketing.guest_ticket_sessions` to Edge Functions

```sql
CREATE OR REPLACE VIEW public.guest_ticket_sessions AS
SELECT * FROM ticketing.guest_ticket_sessions;

GRANT ALL ON public.guest_ticket_sessions TO service_role;
ALTER VIEW public.guest_ticket_sessions SET (security_invoker = on);
```

---

### **5. `public.tickets_enhanced` (VIEW)**
**Purpose**: Flattened view of tickets with event/tier/order data for guest access

**Used By**: `tickets-list-guest` Edge Function

**Columns**:
```sql
-- Ticket fields
id, event_id, tier_id, order_id, status, qr_code, wallet_pass_url,
created_at, redeemed_at, owner_email, owner_name, owner_phone,

-- Event fields (flattened)
event_title, event_date, event_time, event_location, 
organizer_name, cover_image,

-- Tier fields (flattened)
ticket_type, badge, price,

-- Order fields (flattened)
order_date
```

**Filters Used by Guest Access**:
```sql
WHERE owner_email = 'guest@email.com'  -- If email method
   OR owner_phone = '+1234567890'      -- If phone method
  AND status IN ('issued', 'transferred', 'redeemed')
  AND event_id IN (...)                -- If scoped to specific events
```

---

## 🔄 **Guest Flow Database Interaction**

### **Step 1: Request OTP (`guest-tickets-start`)**
```sql
INSERT INTO ticketing.guest_otp_codes (method, contact, otp_hash, expires_at)
VALUES ('email', 'user@example.com', 'abc123...', NOW() + INTERVAL '5 minutes');
```

### **Step 2: Verify OTP (`guest-tickets-verify`)**
```sql
-- 1. Lookup OTP
SELECT * FROM ticketing.guest_otp_codes
WHERE method = 'email' 
  AND contact = 'user@example.com'
  AND otp_hash = 'abc123...'
  AND expires_at > NOW();

-- 2. Create session
INSERT INTO ticketing.guest_ticket_sessions (token_hash, method, contact, scope, expires_at)
VALUES ('def456...', 'email', 'user@example.com', '{"all":true}', NOW() + INTERVAL '30 minutes');

-- 3. Delete used OTP
DELETE FROM ticketing.guest_otp_codes
WHERE method = 'email' AND contact = 'user@example.com';
```

### **Step 3: Fetch Tickets (`tickets-list-guest`)**
```sql
-- 1. Verify session
SELECT * FROM ticketing.guest_ticket_sessions
WHERE token_hash = 'def456...'
  AND expires_at > NOW();

-- 2. Fetch tickets
SELECT * FROM public.tickets_enhanced
WHERE owner_email = 'user@example.com'
  AND status IN ('issued', 'transferred', 'redeemed');
```

---

## 🔐 **Security Features**

### **1. Hashed Storage**
- ✅ OTP codes stored as SHA-256 hashes (never plain text)
- ✅ Session tokens stored as SHA-256 hashes
- ✅ Original values never in database

### **2. Time-Limited**
- ✅ OTP expires in 5 minutes
- ✅ Session expires in 30-45 minutes
- ✅ Automatic cleanup of expired records

### **3. Contact-Based Access**
- ✅ Only shows tickets matching guest's email/phone
- ✅ No cross-contact data leakage
- ✅ Optional event scoping for additional security

### **4. Rate Limiting**
- ✅ Max 3 OTP requests per contact per minute
- ✅ Prevents spam/abuse

---

## 🧪 **Diagnostic Queries**

### **Check Active Guest Sessions**:
```sql
SELECT 
  COUNT(*) as active_sessions,
  method,
  (scope->>'all')::boolean as has_all_access
FROM ticketing.guest_ticket_sessions
WHERE expires_at > NOW()
GROUP BY method, (scope->>'all')::boolean;
```

### **Check Recent OTP Requests**:
```sql
SELECT 
  method,
  LEFT(contact, 10) || '...' as contact_masked,
  expires_at,
  created_at
FROM ticketing.guest_otp_codes
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

### **Check Guest Ticket Access**:
```sql
SELECT 
  COUNT(DISTINCT t.id) as total_tickets,
  COUNT(DISTINCT t.event_id) as unique_events,
  COUNT(DISTINCT t.owner_email) as unique_emails,
  COUNT(DISTINCT t.owner_phone) as unique_phones
FROM public.tickets_enhanced t;
```

---

## 📝 **To Check Your Guest Data**

Run the diagnostic SQL file I created:
1. Go to **Supabase Dashboard → SQL Editor**
2. Open: `check-guest-tables.sql`
3. Click **"Run"**
4. View results to see:
   - All guest-related tables
   - Active sessions count
   - Sample guest session data
   - tickets_enhanced view structure

---

## 🎯 **Key Tables Summary**

| Table | Schema | Purpose | TTL |
|-------|--------|---------|-----|
| `guest_otp_codes` | `ticketing` | Store OTP hashes | 5 min |
| `guest_ticket_sessions` | `ticketing` | Store session tokens | 30-45 min |
| `guest_otp_codes` (view) | `public` | API access to OTP codes | N/A |
| `guest_ticket_sessions` (view) | `public` | API access to sessions | N/A |
| `tickets_enhanced` (view) | `public` | Flattened ticket data | N/A |

---

**Run `check-guest-tables.sql` in Supabase to see your actual data!** 🔍

