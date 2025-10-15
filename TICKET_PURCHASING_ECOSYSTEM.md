# 🎫 Complete Ticket Purchasing Ecosystem

## Overview

This document maps the entire ticket purchasing system including all flows, functions, database tables, variables, and integrations.

### Modernization Goals

To align the Yardpass ticketing experience with current industry standards for both members and guests, the system now emphasizes:

- **Express, low-friction checkout** for authenticated members with saved payment methods.
- **Guest-to-member conversion** through progressive profiling and email verification flows that remain fast and mobile-friendly.
- **Shared orchestration services** that consolidate business logic, pricing, inventory, and risk checks.
- **Operational efficiency** via idempotent APIs, structured observability, and resilient reservation lifecycles.
- **Regulatory and payment compliance** including SCA support, PCI-reduced scope, and auditable order states.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  TicketPurchaseModal.tsx                                     │
│  ├─ Member Flow → enhanced-checkout                          │
│  └─ Guest Flow → guest-checkout                              │
│                                                             │
│  Shared UX Enhancements:                                     │
│  ├─ Real-time tier availability polling                      │
│  ├─ Express checkout button (Apple Pay / Google Pay / Link)  │
│  ├─ Saved attendee profiles & attendee form autofill         │
│  └─ Guest email pre-verification + session persistence       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                CHECKOUT ORCHESTRATION LAYER                  │
├─────────────────────────────────────────────────────────────┤
│  checkout-workflow service (shared module)                  │
│  ├─ Normalizes payloads (member + guest)                    │
│  ├─ Applies pricing, promotions, and fee policies           │
│  ├─ Enforces business rules + rate limits                   │
│  ├─ Emits metrics/log events (structured)                    │
│  └─ Generates idempotency + session identifiers             │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS LAYER                      │
├─────────────────────────────────────────────────────────────┤
│  enhanced-checkout (Member)                                  │
│  guest-checkout (Guest)                                      │
│  checkout-session-status (Shared)                            │
│  ├─ Reserve tickets (reserve_tickets_batch)                  │
│  ├─ Persist checkout_session snapshots                       │
│  ├─ Create/Update order + order_items                        │
│  └─ Initiate Stripe session w/ wallet support                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                      STRIPE LAYER                             │
├─────────────────────────────────────────────────────────────┤
│  Stripe Checkout Session                                      │
│  ├─ Customer enters payment                                   │
│  ├─ Processes payment                                         │
│  └─ Sends webhook on success                                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    WEBHOOK PROCESSING                        │
├─────────────────────────────────────────────────────────────┤
│  stripe-webhook                                              │
│  ├─ Verifies webhook signature                               │
│  ├─ Routes events via event dispatcher                       │
│  ├─ Calls process-payment                                    │
│  ├─ Schedules retries on transient failures                  │
│  └─ Emits audit logs + metrics                               │
│                                                              │
│  process-payment                                             │
│  ├─ Marks order as paid                                      │
│  ├─ Updates stripe_session_id                                │
│  ├─ Calls ensure-tickets                                     │
│  ├─ Releases unused holds                                    │
│  ├─ Publishes notification events                            │
│  └─ Sends confirmation email                                 │
│                                                              │
│  ensure-tickets                                              │
│  ├─ Idempotently creates tickets                             │
│  ├─ Database triggers assign QR codes                        │
│  ├─ Database triggers assign serial numbers                  │
│  ├─ Updates ticket counts                                    │
│  └─ Pushes tickets to attendee wallet                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                             │
├─────────────────────────────────────────────────────────────┤
│  Tables: orders, order_items, tickets, ticket_tiers, checkout_sessions│
│  Functions: reserve_tickets_batch, gen_qr_code               │
│  Triggers: trg_assign_serial_no, trg_ticket_counts           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Frontend Components

### 1. **TicketPurchaseModal.tsx**

**Purpose**: Main UI component for ticket selection and purchase initiation

**Key State Variables**:
```typescript
selections: { [tierId: string]: number }  // Selected quantities per tier
loading: boolean                           // Loading state
submitting: boolean                        // Submitting state
busyRef: useRef(false)                    // Prevents double-submit
user: User | null                         // Authenticated user
guestCode: string                         // Guest access code
validatedCode: { id, code, tier_id }     // Validated guest code
guestEmail: string                        // Guest email address
guestName: string                         // Guest name
guestEmailError: string | null           // Validation error
checkoutSessionId: string | null         // Current checkout session identifier
checkoutExpiresAt: Date | null           // Hold expiration timestamp
expressMethodsEnabled: boolean           // Apple/Google Pay availability
resolvedProfiles: AttendeeProfile[]      // Saved attendee data for autofill
checkoutStage: 'select' | 'details' | 'review' | 'processing'
auditContext: { source: 'web' | 'mobile'; campaign?: string }
```

**Key Computed Values**:
```typescript
summary = {
  subtotal: number,              // Sum of ticket prices
  totalQuantity: number,         // Total tickets selected
  totalFees: number,             // Processing fees
  processingFee: number,         // Stripe processing fee
  grandTotal: number             // Final amount
}

totalTickets: number             // Total ticket count
totalAmount: number              // Total in cents
sessionRemainingMs: number       // Time left before reservation expires
canExpressCheckout: boolean      // Derived from expressMethodsEnabled + auth
```

**Props**:
```typescript
{
  event: Event,                  // Event object
  ticketTiers: TicketTier[],    // Available ticket tiers
  isOpen: boolean,              // Modal visibility
  onClose: () => void,          // Close handler
  onSuccess?: () => void        // Success callback
  referrer?: string             // Marketing attribution
  defaultAttendee?: AttendeeProfile
}
```

**UX Enhancements**:

- **Two-stage validation** – ticket selection is validated client-side, and final validation occurs using the shared `checkout-session-status` endpoint before payment.
- **Reservation countdown** – communicates remaining hold time and renews reservations on interaction to reduce expiry drop-off.
- **Guest uplift prompts** – offers passwordless account creation post-payment to convert high-intent guests into members.
- **Optimistic UI updates** – uses React Query/SWR for caching tier availability and reduces flicker on tier refreshes.
- **Wallet awareness** – conditionally renders Apple Pay/Google Pay buttons when device/browser support is detected.

---

## 🔧 Edge Functions

### 1. **enhanced-checkout** (Member Purchases)

**File**: `supabase/functions/enhanced-checkout/index.ts`

**Authentication**: JWT Required (✅)

**Input Variables**:
```typescript
{
  eventId: string,              // UUID of event
  ticketSelections: [{
    tierId: string,             // UUID of ticket tier
    quantity: number            // Number of tickets
  }]
}
```

**Process Enhancements**:
1. Authenticates user via JWT and validates membership status/roles.
2. Delegates request to the shared `checkout-workflow` module to normalize payloads.
3. Fetches event/tier data and performs availability checks with optimistic locking.
4. Reserves tickets via `reserve_tickets_batch` RPC with an idempotency key tied to `checkoutSessionId`.
5. Applies fee schedule (`faceValue * 0.066 + 2.19`) and promotion/discount logic.
6. Persists or updates the unified `checkout_sessions` snapshot.
7. Creates/updates Stripe checkout session including wallet + Link support and attaches saved payment method when available.
8. Stores order + order_items in database with enriched metadata (device, campaign, payment method type).
9. Returns checkout URL and checkout session details for countdown timers.

**Output**:
```typescript
{
  url: string,             // Stripe checkout URL
  checkoutSessionId: string,
  expiresAt: string,
  paymentSummary: {
    subtotalCents: number,
    feesCents: number,
    totalCents: number
  }
}
```

**Environment Variables Required**:
- `STRIPE_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `SITE_URL` (optional)

---

### 2. **guest-checkout** (Guest Purchases)

**File**: `supabase/functions/guest-checkout/index.ts`

**Authentication**: JWT NOT Required (❌)

**Input Variables**:
```typescript
{
  event_id: string,             // UUID of event
  items: [{
    tier_id: string,            // UUID of ticket tier
    quantity: number,           // Number of tickets
    unit_price_cents?: number   // Optional price override
  }],
  contact_email: string,        // Guest email (required)
  contact_name?: string,        // Guest name (optional)
  contact_phone?: string,       // Guest phone (optional)
  guest_code?: string | null    // Guest access code (optional)
}
```

**Process Enhancements**:
1. Validates email format and triggers passwordless magic-link verification when time allows (skipped on express wallets to minimize friction).
2. Searches for existing user by email and merges with guest metadata if the user later upgrades to a full account.
3. Creates guest user with metadata `{ created_via: 'guest_checkout', marketing_opt_in }` when no account exists.
4. Creates/updates `user_profile` and stores marketing attribution + device fingerprint hash for fraud review.
5. Reserves tickets via `reserve_tickets_batch` with idempotency + geofenced rate limiting.
6. Applies fee schedule (`faceValue * 0.066 + 2.19`) and promo logic (e.g., guest welcome codes).
7. Persists unified `checkout_sessions` snapshot (contact info, holds, pricing, verification status).
8. Creates Stripe checkout session with support for Link/Apple Pay/Google Pay + collects billing address when SCA requires.
9. Stores order + order_items in database with guest contact info and onboarding hints.
10. Returns checkout URL, session expiration, and metadata for progress tracking.

**Output**:
```typescript
{
  url: string,
  checkoutSessionId: string,
  expiresAt: string,
  requiresEmailVerification: boolean,
  upsellEligible: boolean
}
```

**Environment Variables Required**:
- `STRIPE_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SITE_URL` (optional)

---

### 3. **checkout-session-status** (Shared)

**File**: `supabase/functions/checkout-session-status/index.ts`

**Authentication**: Optional JWT – relies on session ID + hashed email when unauthenticated.

**Input Variables**:
```typescript
{
  checkoutSessionId: string,
  email?: string
}
```

**Process**:
1. Retrieves the `checkout_sessions` record and verifies caller access (user ID match or hashed email).
2. Refreshes reservations nearing expiry and extends holds when the user is still active on the page.
3. Returns pricing snapshots, payment method eligibility flags, and verification statuses for UI display.
4. Emits analytics events for heartbeat tracking to spot abandonment trends.

**Output**:
```typescript
{
  status: 'pending' | 'converted' | 'expired',
  expiresAt: string,
  pricing: {
    subtotalCents: number,
    feesCents: number,
    totalCents: number
  },
  canExtendHold: boolean,
  expressMethods: {
    applePay: boolean,
    googlePay: boolean,
    link: boolean
  },
  verification: {
    emailVerified: boolean,
    riskScore: number
  }
}
```

---

### 4. **stripe-webhook**

**File**: `supabase/functions/stripe-webhook/index.ts`

**Authentication**: JWT NOT Required (❌) - Uses Stripe signature instead

**Input**: Stripe Webhook Event (raw body)

**Process**:
1. Verifies Stripe webhook signature
2. Extracts `checkout.session.completed` event
3. Calls `process-payment` with session ID
4. Returns success/error

**Environment Variables Required**:
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

### 5. **process-payment**

**File**: `supabase/functions/process-payment/index.ts`

**Authentication**: JWT NOT Required (❌)

**Input Variables**:
```typescript
{
  sessionId: string  // Stripe checkout session ID
}
```

**Process**:
1. Fetches Stripe session details
2. Finds order by `checkout_session_id` or `stripe_session_id`
3. Updates order:
   - Sets `status = 'paid'`
   - Sets `paid_at = NOW()`
   - Sets `stripe_session_id = session.id`
   - Sets `stripe_payment_intent_id = payment_intent`
4. Calls `ensure-tickets` to create tickets
5. Releases expired holds, flags anomalies, and posts structured audit log entries.
6. Schedules async enrichment jobs (e.g., CRM sync, marketing automation, analytics).
7. Sends confirmation email via Resend and optionally SMS/push notifications.
8. Returns success

**Output**:
```typescript
{
  success: boolean,
  order_id: string,
  tickets_created: number
}
```

**Environment Variables Required**:
- `STRIPE_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `SITE_URL`

---

### 6. **ensure-tickets**

**File**: `supabase/functions/ensure-tickets/index.ts`

**Authentication**: JWT NOT Required (❌)

**Input Variables**:
```typescript
{
  order_id?: string,      // Order UUID
  session_id?: string     // Stripe session ID (alternative)
}
```

**Process**:
1. Fetches order and order_items
2. Checks if tickets already exist (idempotency)
3. Creates ticket records for each order item
4. Database triggers automatically:
   - Generate QR codes via `gen_qr_code()`
   - Assign serial numbers via `trg_assign_serial_no`
   - Update ticket counts via `trg_ticket_counts`
5. Syncs newly created tickets to the attendee wallet (mobile passbook + in-app storage)
6. Emits domain events for downstream fulfillment (e.g., door list refresh)

**Output**:
```typescript
{
  status: 'already_issued' | 'created' | 'pending',
  order_id: string,
  tickets_created: number,
  tickets: Ticket[]
}
```

---

## 🗄️ Database Schema

### **orders** Table

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  event_id UUID REFERENCES events,
  
  -- Stripe Integration
  stripe_session_id TEXT,           -- Stripe checkout session ID
  stripe_payment_intent_id TEXT,    -- Stripe payment intent ID
  checkout_session_id TEXT,         -- Legacy field
  
  -- Order Details
  status TEXT,                      -- 'pending' | 'paid' | 'cancelled' | 'refunded'
  subtotal_cents INTEGER,           -- Ticket prices total
  fees_cents INTEGER,               -- Processing fees
  total_cents INTEGER,              -- Grand total
  currency TEXT DEFAULT 'USD',
  
  -- Contact Info (for guests)
  contact_email TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  
  -- Metadata
  hold_ids UUID[],                  -- Reserved ticket hold IDs
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Fields**:
- `stripe_session_id`: Links to Stripe checkout session (populated by webhook)
- `status`: Order status lifecycle
- `subtotal_cents`: Face value of all tickets
- `fees_cents`: Processing fees (6.6% + $2.19)
- `total_cents`: Total charged to customer

---

### **order_items** Table

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders,
  tier_id UUID REFERENCES ticket_tiers,
  
  quantity INTEGER,                 -- Number of tickets
  unit_price_cents INTEGER,         -- Price per ticket at time of purchase
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### **tickets** Table

```sql
CREATE TABLE tickets (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events,
  tier_id UUID REFERENCES ticket_tiers,
  order_id UUID REFERENCES orders,
  owner_user_id UUID REFERENCES auth.users,
  
  -- Ticket Identity
  qr_code TEXT UNIQUE,              -- Auto-generated QR code
  serial_number TEXT,               -- Sequential serial number
  
  -- Status
  status TEXT,                      -- 'issued' | 'scanned' | 'void' | 'refunded'
  scanned_at TIMESTAMP,
  scanned_by UUID,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Auto-Generated Fields**:
- `qr_code`: Generated by `gen_qr_code()` function on INSERT
- `serial_number`: Assigned by `trg_assign_serial_no` trigger

---

### **ticket_tiers** Table

```sql
CREATE TABLE ticket_tiers (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events,
  
  name TEXT,                        -- 'General Admission', 'VIP', etc.
  price_cents INTEGER,              -- Base ticket price
  badge_label TEXT,                 -- Display label
  
  quantity INTEGER,                 -- Total available
  max_per_order INTEGER,            -- Purchase limit per order
  sort_index INTEGER,               -- Display order
  
  status TEXT,                      -- 'active' | 'sold_out' | 'inactive'
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

### **checkout_sessions** Table (New)

```sql
CREATE TABLE checkout_sessions (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders,
  user_id UUID REFERENCES auth.users,
  event_id UUID REFERENCES events,

  status TEXT,                       -- 'pending' | 'expired' | 'converted'
  hold_ids UUID[],                   -- Holds returned from reserve_tickets_batch
  pricing_snapshot JSONB,            -- { subtotal_cents, fees_cents, total_cents, currency }
  contact_snapshot JSONB,            -- { email, name, phone }
  verification_state JSONB,          -- { email_verified: boolean, risk_score: number }
  express_methods JSONB,             -- Wallet/payment method availability flags
  expires_at TIMESTAMP,              -- Reservation expiration timestamp
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes & Retention**:
- `CREATE INDEX idx_checkout_sessions_order ON checkout_sessions(order_id);`
- `CREATE INDEX idx_checkout_sessions_expires ON checkout_sessions(expires_at);`
- Automatic cleanup job prunes expired sessions beyond 24 hours.

---

## 🔄 Database Functions & Triggers

### **reserve_tickets_batch** RPC Function

**Purpose**: Atomically reserve tickets to prevent overselling

```sql
CREATE FUNCTION reserve_tickets_batch(
  p_reservations JSONB,             -- Array of {tier_id, quantity}
  p_session_id TEXT DEFAULT NULL,   -- Session identifier
  p_user_id UUID DEFAULT NULL,      -- User making reservation
  p_expires_minutes INTEGER DEFAULT 15
) RETURNS JSONB
```

**Process**:
1. For each tier, calls `reserve_tickets_atomic`
2. Checks available quantity
3. Creates hold record with expiration
4. Returns success/failure for each reservation

**Returns**:
```json
{
  "success": true,
  "hold_ids": ["uuid1", "uuid2"],
  "reservations": [...]
}
```

---

### **gen_qr_code** Function

**Purpose**: Generates unique QR code for tickets

```sql
CREATE FUNCTION gen_qr_code() RETURNS TEXT
```

**Process**:
1. Generates random 16-character alphanumeric string
2. Ensures uniqueness in tickets table
3. Returns QR code string

**Used By**: `tickets` table default value for `qr_code` column

---

### **trg_assign_serial_no** Trigger

**Purpose**: Auto-assigns sequential serial numbers to tickets

```sql
CREATE TRIGGER trg_assign_serial_no
  BEFORE INSERT ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_assign_serial_no();
```

**Process**:
1. Counts existing tickets for event
2. Assigns next sequential number
3. Format: Event-specific counter

---

### **trg_ticket_counts** Trigger

**Purpose**: Maintains accurate ticket counts on tiers

```sql
CREATE TRIGGER trg_ticket_counts
  AFTER INSERT OR DELETE ON tickets
  FOR EACH ROW 
  EXECUTE FUNCTION public.tg_ticket_counts();
```

**Process**:
1. Recalculates sold ticket count for tier
2. Updates `ticket_tiers` table
3. Updates `sold_out` status if necessary

---

## 💰 Fee Calculation

### **Processing Fee Formula**

All functions use consistent formula:

```typescript
const faceValue = subtotalCents / 100;
const processingFee = faceValue * 0.066 + 2.19;
const totalCents = Math.round((faceValue + processingFee) * 100);
const feesCents = totalCents - subtotalCents;
```

**Example**:
- Ticket price: $30.00
- Processing fee: $30.00 × 0.066 + $2.19 = $4.17
- Total: $34.17

**Variables**:
- `subtotalCents`: Total face value of tickets in cents
- `faceValue`: Face value in dollars
- `processingFee`: Calculated fee in dollars (6.6% + $2.19)
- `totalCents`: Final total in cents
- `feesCents`: Fee portion in cents

---

## 🔐 Authentication & Authorization

### **Member Flow**:
- ✅ **JWT Required**: Yes
- **Headers**: `Authorization: Bearer <jwt_token>`
- **User Context**: `auth.users` record
- **Profile**: `user_profiles` record

### **Guest Flow**:
- ❌ **JWT Required**: No
- **Creates**: New `auth.users` record
- **User Metadata**: `{ created_via: 'guest_checkout' }`
- **App Metadata**: `{ roles: ['guest'] }`
- **Profile**: Auto-created `user_profiles` record

---

## 🌐 External Integrations

### **1. Stripe**

**API Version**: `2023-10-16`

**Used For**:
- Creating checkout sessions
- Processing payments
- Webhook notifications

**Key Objects**:
```typescript
// Checkout Session
{
  id: 'cs_...',
  payment_intent: 'pi_...',
  customer: 'cus_...',
  amount_total: number,
  currency: string,
  payment_status: 'paid' | 'unpaid',
  metadata: {
    event_id: string,
    user_id: string,
    hold_ids: string
  }
}

// Webhook Event
{
  type: 'checkout.session.completed',
  data: {
    object: CheckoutSession
  }
}
```

**Environment Variables**:
- `STRIPE_SECRET_KEY`: API secret key
- `STRIPE_WEBHOOK_SECRET`: Webhook signing secret

---

### **2. Resend (Email)**

**Used For**: Sending ticket confirmation emails

**API Call**:
```typescript
POST https://api.resend.com/emails
Headers: {
  'Authorization': `Bearer ${RESEND_API_KEY}`,
  'Content-Type': 'application/json'
}
Body: {
  from: 'noreply@yourdomain.com',
  to: customer_email,
  subject: 'Your Tickets',
  html: emailTemplate
}
```

**Environment Variables**:
- `RESEND_API_KEY`: API key

---

## 🎯 Key Data Flows

### **Member Purchase Flow - Complete Variable Trace**

1. **Frontend Selection**:
```typescript
selections = { 
  'tier-uuid-1': 2,  // 2 tickets of tier 1
  'tier-uuid-2': 1   // 1 ticket of tier 2
}
```

2. **Frontend Calculation**:
```typescript
subtotal = 60.00  // $30 × 2 + $30 × 1
fees = 6.15       // 60 × 0.066 + 2.19
total = 66.15
totalCents = 6615
```

3. **API Call to enhanced-checkout**:
```typescript
{
  eventId: 'event-uuid',
  ticketSelections: [
    { tierId: 'tier-uuid-1', quantity: 2 },
    { tierId: 'tier-uuid-2', quantity: 1 }
  ]
}
```

4. **Backend Reservation**:
```typescript
reserve_tickets_batch({
  p_reservations: [
    { tier_id: 'tier-uuid-1', quantity: 2 },
    { tier_id: 'tier-uuid-2', quantity: 1 }
  ],
  p_session_id: 'generated-session-uuid',
  p_user_id: 'user-uuid',
  p_expires_minutes: 15
})
→ Returns: { success: true, hold_ids: ['hold-1', 'hold-2'] }
```

5. **Stripe Session Creation**:
```typescript
stripe.checkout.sessions.create({
  line_items: [{
    price_data: {
      currency: 'usd',
      unit_amount: 6615,  // Total with fees
      product_data: { name: 'Event Tickets' }
    },
    quantity: 1
  }],
  metadata: {
    event_id: 'event-uuid',
    user_id: 'user-uuid',
    hold_ids: '["hold-1", "hold-2"]'
  }
})
→ Returns: { id: 'cs_...', url: 'https://checkout.stripe.com/...' }
```

6. **Order Creation**:
```sql
INSERT INTO orders VALUES (
  id: 'order-uuid',
  user_id: 'user-uuid',
  event_id: 'event-uuid',
  checkout_session_id: 'cs_...',
  status: 'pending',
  subtotal_cents: 6000,
  fees_cents: 615,
  total_cents: 6615,
  hold_ids: ['hold-1', 'hold-2']
)
```

7. **Order Items Creation**:
```sql
INSERT INTO order_items VALUES
  (order_id: 'order-uuid', tier_id: 'tier-1', quantity: 2, unit_price_cents: 3000),
  (order_id: 'order-uuid', tier_id: 'tier-2', quantity: 1, unit_price_cents: 3000)
```

8. **Customer Payment** (on Stripe)

9. **Webhook Received**:
```typescript
{
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_...',
      payment_status: 'paid',
      payment_intent: 'pi_...'
    }
  }
}
```

10. **process-payment Called**:
```typescript
{ sessionId: 'cs_...' }
```

11. **Order Updated**:
```sql
UPDATE orders SET
  status = 'paid',
  paid_at = NOW(),
  stripe_session_id = 'cs_...',
  stripe_payment_intent_id = 'pi_...'
WHERE checkout_session_id = 'cs_...'
```

12. **ensure-tickets Called**:
```typescript
{ order_id: 'order-uuid' }
```

13. **Tickets Created**:
```sql
INSERT INTO tickets VALUES
  (id: 'ticket-1', event_id: 'event-uuid', tier_id: 'tier-1', order_id: 'order-uuid', owner_user_id: 'user-uuid', status: 'issued'),
  (id: 'ticket-2', event_id: 'event-uuid', tier_id: 'tier-1', order_id: 'order-uuid', owner_user_id: 'user-uuid', status: 'issued'),
  (id: 'ticket-3', event_id: 'event-uuid', tier_id: 'tier-2', order_id: 'order-uuid', owner_user_id: 'user-uuid', status: 'issued')
```

14. **Triggers Fire**:
- `qr_code` auto-generated: 'ABC123DEF456'
- `serial_number` assigned: 'EVT001', 'EVT002', 'EVT003'
- Ticket counts updated on tiers

15. **Email Sent**:
```typescript
{
  to: 'user@email.com',
  subject: 'Your Tickets for Event Name',
  body: 'Your 3 tickets are ready...'
}
```

16. **Session Finalization**:
```sql
UPDATE checkout_sessions
SET status = 'converted', updated_at = NOW()
WHERE id = 'checkout-session-uuid';
```

---

## 📊 Status Values

### **Order Status**:
- `pending`: Order created, awaiting payment
- `paid`: Payment successful, tickets issued
- `cancelled`: Order cancelled before payment
- `refunded`: Payment refunded, tickets voided

### **Ticket Status**:
- `issued`: Ticket created and valid
- `scanned`: Ticket scanned at event
- `void`: Ticket invalidated
- `refunded`: Ticket refunded

### **Tier Status**:
- `active`: Available for purchase
- `sold_out`: No tickets remaining
- `inactive`: Not available for purchase

---

## 🔍 Debugging Variables

### **Common Log Points**:

```typescript
// Frontend
console.log('User:', user?.id);
console.log('Selections:', selections);
console.log('Total:', totalAmount);

// enhanced-checkout
console.log('[ENHANCED-CHECKOUT] User authenticated:', userId);
console.log('[ENHANCED-CHECKOUT] Reservations:', reservationResult);
console.log('[ENHANCED-CHECKOUT] Stripe session:', session.id);

// stripe-webhook
console.log('[STRIPE-WEBHOOK] Event type:', event.type);
console.log('[STRIPE-WEBHOOK] Session ID:', session.id);

// process-payment
console.log('[PROCESS-PAYMENT] Order found:', order.id);
console.log('[PROCESS-PAYMENT] Tickets created:', ticketsCreated);

// ensure-tickets
console.log('[ENSURE-TICKETS] Order:', order.id);
console.log('[ENSURE-TICKETS] Status:', status);
```

---

## 🎉 Success Indicators

### **Complete Purchase Checklist**:

✅ Order created with `status = 'pending'`  
✅ `stripe_session_id` populated in order  
✅ Order updated to `status = 'paid'`  
✅ `paid_at` timestamp set  
✅ Tickets created (count matches order quantity)
✅ QR codes generated on all tickets
✅ Serial numbers assigned
✅ Ticket counts updated on tiers
✅ Confirmation email sent
✅ Checkout session marked `converted` or released when expired

### **Database Verification Query**:

```sql
SELECT 
  o.id as order_id,
  o.status,
  o.stripe_session_id,
  o.paid_at,
  o.total_cents,
  COUNT(t.id) as ticket_count,
  COUNT(CASE WHEN t.qr_code IS NOT NULL THEN 1 END) as qr_codes_generated,
  au.email
FROM orders o
LEFT JOIN tickets t ON t.order_id = o.id
LEFT JOIN auth.users au ON o.user_id = au.id
WHERE o.id = 'YOUR_ORDER_ID'
GROUP BY o.id, au.email;
```

Expected Result:
```
order_id | status | stripe_session_id | paid_at | total_cents | ticket_count | qr_codes_generated | email
---------|--------|-------------------|---------|-------------|--------------|-------------------|-------
uuid     | paid   | cs_...           | <time>  | 6615        | 3            | 3                 | user@email.com
```

---

## 🚨 Common Issues & Solutions

### **Issue 1: `stripe_session_id` is NULL**
**Cause**: Webhook not firing or `process-payment` not updating
**Solution**: Check webhook logs, verify webhook secret

### **Issue 2: Tickets not created**
**Cause**: `ensure-tickets` not called or failing
**Solution**: Check `process-payment` logs, verify order_items exist

### **Issue 3: QR codes missing**
**Cause**: Database trigger not firing
**Solution**: Check trigger exists: `trg_assign_serial_no`

### **Issue 4: Wrong fee calculation**
**Cause**: Inconsistent formula across functions
**Solution**: Use: `faceValue * 0.066 + 2.19`

---

## 🚀 Member Express Checkout Enhancements

1. **Account Context Preload** – the modal hydrates membership tier, loyalty balance, and saved attendees on open to minimize API calls mid-checkout.
2. **Saved Payment Reuse** – Stripe customer IDs are stored on the order and automatically attached to the session, enabling one-click confirmation via Link/Wallets.
3. **Multi-attendee Autofill** – members can select existing attendee profiles; the UI pre-fills names/emails and syncs them back to the order metadata for downstream experiences.
4. **Reservation Renewal** – background timers refresh holds when members adjust quantities, reducing cancellation churn.
5. **Post-purchase Upsell** – upon success the member receives targeted add-on offers (parking, merch) powered by the `checkout-workflow` metadata.

---

## 🙌 Guest Checkout Enhancements

1. **Progressive Profiling** – capture email first, allow optional name/phone, and prompt for passwordless upgrade only after purchase.
2. **Magic Link Verification** – when time allows, send a verification link that doubles as login credentials for future visits, driving conversion without blocking payment.
3. **Fraud Controls** – throttle by IP/device fingerprint, check disposable email lists, and block repeated failed attempts using the `checkout_sessions` table.
4. **Session Persistence** – store cart selections in `checkout_sessions` to allow resume across devices within the hold window.
5. **Guest-to-member Nudge** – confirmation email includes CTA to claim account and set password, carrying over purchase history automatically.

---

## 📊 Operational Monitoring & Efficiency

- **Metrics** – emit `checkout.session_created`, `checkout.session_converted`, `checkout.session_expired`, `ticket.issued`, and `ticket.scanned` metrics with tags (`flow=member|guest`, `device=web|mobile`).
- **Tracing** – propagate a `checkoutTraceId` from frontend through edge functions and webhooks for distributed tracing in Honeycomb/DataDog.
- **Alerting** – trigger alerts on high expiration rates (>5%), webhook retry spikes, or ticket issuance latency >30s.
- **Data Retention** – archive aged `checkout_sessions` and `order_items` into cold storage monthly to keep OLTP lean.
- **Accessibility QA** – automated Playwright + Axe scans ensure the modal meets WCAG 2.1 AA for all flows.

---

## 📝 Summary

The modernized ticket purchasing ecosystem now offers:

- **3 Entry Points**: Member (enhanced-checkout), Guest (guest-checkout), and Session status polling.
- **6 Core Functions**: enhanced-checkout, guest-checkout, checkout-session-status, stripe-webhook, process-payment, ensure-tickets.
- **5 Main Tables**: orders, order_items, tickets, ticket_tiers, checkout_sessions.
- **Shared Checkout Orchestration**: checkout-workflow module handles pricing, validation, logging, and idempotency for both flows.
- **Industry-standard Payment UX**: wallet support, Link, SCA readiness, and express checkout timers.
- **Lifecycle Automation**: structured logging, audit events, downstream notifications, and hold release automation.

All flows converge at the webhook processing layer and result in:
✅ Paid orders
✅ Checkout sessions converted or expired cleanly
✅ Issued tickets delivered to attendee wallets
✅ Generated QR codes and serial numbers
✅ Confirmation emails/SMS dispatched with conversion nudges

