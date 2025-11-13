# Liventix Ticketing System - Complete Structure

## Core Ticketing Files

### 1. Main Ticketing Components

#### `src/components/TicketPurchaseModal.tsx` (529 lines)
**Purpose**: Main modal for purchasing tickets
- Multi-tier ticket selection
- Guest code validation
- Quantity selection per tier
- Subtotal and fee calculation
- Stripe checkout integration

**Key Features**:
```typescript
interface TicketPurchaseModalProps {
  event: Event;
  ticketTiers: TicketTier[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Guest code validation
- validateGuestCode() - Validates promo/guest codes
- Checks expiration, usage limits
- Auto-applies tier discounts

// Purchase flow
- Stripe checkout session creation
- Order creation in database
- Ticket issuance after payment
```

#### `src/components/EventTicketModal.tsx` (208 lines)
**Purpose**: Displays available tickets for an event
- Fetches ticket tiers for event
- Shows ticket availability
- Past event handling
- Launches purchase modal

**Flow**:
1. User clicks "Get Tickets" on event
2. Modal fetches ticket tiers from database
3. Displays tiers with pricing and availability
4. User selects tier → Opens TicketPurchaseModal

#### `src/components/TicketsPage.tsx`
**Purpose**: User's ticket wallet/collection
- Lists all tickets owned by user
- QR code display for scanning
- Ticket status (issued, redeemed, transferred)
- Ticket details and event info

#### `src/components/TicketsRoute.tsx`
**Purpose**: Route wrapper for tickets page
- Handles authentication
- Deep linking to specific tickets
- Navigation integration

#### `src/components/TicketSuccessPage.tsx` (444 lines)
**Purpose**: Post-purchase success page
- Order confirmation display
- Ticket download/wallet pass generation
- ICS calendar file generation
- Email confirmation status
- Navigation to ticket wallet

**Features**:
- Poll order status until complete
- Progress indicator for ticket issuance
- Add to Calendar (ICS download)
- Add to Apple/Google Wallet
- View purchased tickets
- Share event

---

### 2. Advanced Ticketing Components

#### `src/components/EnhancedTicketManagement.tsx` (473 lines)
**Purpose**: Organizer ticket management dashboard
- Real-time ticket sales monitoring
- Availability tracking
- Sales analytics
- Tier management
- Guest code creation

**Features**:
```typescript
// Real-time updates
- WebSocket/Realtime subscriptions
- Live ticket sales counter
- Availability updates

// Tier management
- Create/edit/disable tiers
- Set pricing and limits
- Sales start/end times

// Guest codes
- Generate promo codes
- Set usage limits and expiration
- Track redemptions
```

#### `src/components/ClaimTicketsPrompt.tsx`
**Purpose**: Prompt for claiming guest/transferred tickets
- Guest ticket claim flow
- Transferred ticket acceptance
- Account linking for claimed tickets

---

### 3. Ticket Scanning & Validation

#### `src/components/ScannerPage.tsx` (897 lines)
**Purpose**: QR code scanner for ticket validation at entry
- Camera-based QR scanner
- Ticket validation
- Entry logging
- Duplicate scan prevention

**Scanner Features**:
```typescript
// Scanning modes
- Single scan mode
- Continuous scan mode
- Manual code entry

// Validation
- Real-time ticket verification
- Status check (valid, redeemed, invalid)
- Duplicate scan detection

// Entry logging
- Creates scan_logs entry
- Updates ticket redeemed_at timestamp
- Organizer/scanner attribution
```

---

### 4. Hooks & Business Logic

#### `src/hooks/useTickets.tsx`
**Purpose**: Ticket data management hook
```typescript
export function useTickets() {
  // Fetch user's tickets
  const tickets = useQuery(['tickets', userId], fetchTickets);
  
  // Ticket operations
  - refreshTickets() - Force refresh
  - forceRefreshTickets() - Clear cache and refresh
  - getTicketByQR(qrCode) - Lookup by QR
  
  return {
    tickets,
    loading,
    error,
    refreshTickets,
    forceRefreshTickets,
  };
}
```

#### `src/hooks/useTicketAnalytics.tsx`
**Purpose**: Ticket analytics for organizers
```typescript
export function useTicketAnalytics(eventId: string) {
  // Fetch ticket analytics
  - Total sales
  - Revenue by tier
  - Sales over time
  - Redemption rate
  - Guest code usage
  
  return {
    analytics,
    loading,
    refresh,
  };
}
```

---

## Database Schema

### Core Tables

#### `ticket_tiers` table
```sql
CREATE TABLE ticket_tiers (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES events(id),
  name text NOT NULL,                    -- "General Admission", "VIP", etc.
  badge_label text,                      -- Optional badge display
  price_cents int NOT NULL DEFAULT 0,    -- Price in cents
  currency text NOT NULL DEFAULT 'USD',
  quantity int,                          -- NULL = unlimited
  max_per_order int DEFAULT 6,
  sales_start timestamptz,               -- When sales open
  sales_end timestamptz,                 -- When sales close
  status text DEFAULT 'active',          -- active, sold_out, disabled
  sort_index int DEFAULT 0,              -- Display order
  created_at timestamptz DEFAULT now()
);
```

#### `orders` table
```sql
CREATE TABLE orders (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  event_id uuid REFERENCES events(id),
  status order_status DEFAULT 'pending',     -- pending, completed, cancelled, refunded
  subtotal_cents int NOT NULL DEFAULT 0,
  fees_cents int NOT NULL DEFAULT 0,         -- Platform + processing fees
  total_cents int NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  stripe_session_id text UNIQUE,             -- Stripe checkout session
  stripe_payment_intent_id text UNIQUE,      -- Stripe payment intent
  payout_destination_owner owner_context,    -- individual or organization
  payout_destination_id uuid,                -- Destination account ID
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz                        -- When payment completed
);
```

#### `order_items` table
```sql
CREATE TABLE order_items (
  id uuid PRIMARY KEY,
  order_id uuid REFERENCES orders(id),
  tier_id uuid REFERENCES ticket_tiers(id),
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price_cents int NOT NULL,             -- Price at time of purchase
  created_at timestamptz DEFAULT now()
);
```

#### `tickets` table
```sql
CREATE TABLE tickets (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES events(id),
  tier_id uuid REFERENCES ticket_tiers(id),
  order_id uuid REFERENCES orders(id),
  owner_user_id uuid REFERENCES auth.users(id),
  status ticket_status DEFAULT 'issued',     -- issued, redeemed, transferred, cancelled
  qr_code text UNIQUE NOT NULL,              -- Unique QR code for scanning
  wallet_pass_url text,                      -- Apple/Google Wallet pass URL
  redeemed_at timestamptz,                   -- When scanned at entry
  created_at timestamptz DEFAULT now()
);
```

#### `refunds` table
```sql
CREATE TABLE refunds (
  id uuid PRIMARY KEY,
  order_id uuid REFERENCES orders(id),
  amount_cents int NOT NULL,
  reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
```

#### `scan_logs` table
```sql
CREATE TABLE scan_logs (
  id uuid PRIMARY KEY,
  ticket_id uuid REFERENCES tickets(id),
  event_id uuid REFERENCES events(id),
  scanner_user_id uuid REFERENCES auth.users(id),
  scan_result text,                          -- valid, duplicate, invalid, expired
  scanned_at timestamptz DEFAULT now(),
  device_info jsonb                          -- Scanner device metadata
);
```

#### `guest_codes` table
```sql
CREATE TABLE guest_codes (
  id uuid PRIMARY KEY,
  event_id uuid REFERENCES events(id),
  tier_id uuid REFERENCES ticket_tiers(id), -- Optional specific tier
  code text NOT NULL UNIQUE,                 -- "EARLYBIRD", "VIP2024", etc.
  discount_percent int,                      -- Percentage discount
  discount_amount_cents int,                 -- Fixed discount amount
  max_uses int NOT NULL,                     -- Usage limit
  used_count int DEFAULT 0,                  -- Current usage count
  expires_at timestamptz,                    -- Expiration date
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
```

---

## Ticket Purchase Flow

### Complete Purchase Journey:

```
1. User Discovery
   └─> Browse events on feed
   └─> Click event card
   └─> View EventSlugPage with event details

2. Ticket Selection
   └─> Click "Get Tickets" button
   └─> EventTicketModal opens
   └─> Displays available ticket tiers
   └─> User clicks "Select" on desired tier

3. Purchase Configuration
   └─> TicketPurchaseModal opens
   └─> User selects quantity for each tier
   └─> Optional: Enter guest code
       └─> Validates code
       └─> Applies discount if valid
   └─> Shows subtotal + fees + total
   └─> User clicks "Proceed to Checkout"

4. Payment Processing
   └─> Create Stripe checkout session
   └─> Redirect to Stripe hosted checkout
   └─> User enters payment details
   └─> Stripe processes payment
   └─> Webhook confirms payment

5. Ticket Issuance
   └─> Create order record (status: completed)
   └─> Create order_items records
   └─> Generate QR codes
   └─> Create ticket records for each quantity
   └─> Send confirmation email
   └─> Generate wallet passes

6. Confirmation
   └─> Redirect to TicketSuccessPage
   └─> Display order details
   └─> Show ticket count
   └─> Offer calendar download
   └─> Offer wallet pass download
   └─> Button to view tickets in wallet

7. Ticket Access
   └─> Navigate to /tickets
   └─> TicketsPage displays all user tickets
   └─> Each ticket shows:
       ├─> Event details
       ├─> QR code for scanning
       ├─> Ticket tier/badge
       ├─> Status (issued/redeemed)
       └─> Event date/time/location
```

---

## Ticket Scanning Flow

### Entry Validation Process:

```
1. Scanner Setup
   └─> Organizer/staff opens ScannerPage
   └─> Selects event to scan for
   └─> Grants camera permissions

2. Scanning
   └─> User with ticket opens TicketsPage
   └─> QR code displayed on screen
   └─> Scanner captures QR code
   └─> System validates ticket:
       ├─> Valid event?
       ├─> Already redeemed?
       ├─> Status = issued?
       └─> Not expired?

3. Validation Result
   ├─> ✅ VALID
   │   └─> Update ticket.redeemed_at
   │   └─> Create scan_log entry (result: valid)
   │   └─> Show success message
   │   └─> Display attendee name/tier
   │
   ├─> ⚠️ DUPLICATE
   │   └─> Create scan_log entry (result: duplicate)
   │   └─> Show warning with first scan time
   │   └─> Display "Already admitted at HH:MM"
   │
   └─> ❌ INVALID
       └─> Create scan_log entry (result: invalid)
       └─> Show error message
       └─> Display reason (wrong event, cancelled, expired)

4. Entry Logging
   └─> All scans logged in scan_logs table
   └─> Analytics for organizer dashboard
   └─> Attendance tracking
```

---

## Guest Codes & Promotions

### Guest Code System:

```typescript
// Guest code types
1. Tier-specific codes
   - VIPEARLY → Only works for VIP tier
   - GA50 → Only works for General Admission

2. Event-wide codes
   - LAUNCH25 → 25% off any tier
   - FRIEND10 → $10 off any purchase

3. Usage limits
   - max_uses: 100 → Code works for first 100 uses
   - expires_at: "2024-12-31" → Code expires at date

4. Discount types
   - Percentage: discount_percent: 20 (20% off)
   - Fixed amount: discount_amount_cents: 1000 ($10 off)
```

**Guest Code Validation**:
```typescript
async function validateGuestCode(code: string, eventId: string) {
  // 1. Fetch guest code
  const guestCode = await fetchGuestCode(code, eventId);
  
  // 2. Check validity
  if (!guestCode) return { valid: false, error: 'Invalid code' };
  if (guestCode.expires_at < now()) return { valid: false, error: 'Expired' };
  if (guestCode.used_count >= guestCode.max_uses) return { valid: false, error: 'Usage limit reached' };
  
  // 3. Apply discount
  const discount = calculateDiscount(guestCode, subtotal);
  
  // 4. Return validated code
  return { valid: true, discount, tier_id: guestCode.tier_id };
}
```

---

## Ticket Transfer & Resale (Future)

### Planned Features:

```typescript
// Ticket transfer
interface TicketTransfer {
  ticket_id: uuid;
  from_user_id: uuid;
  to_user_id: uuid;
  to_email: string;
  status: 'pending' | 'accepted' | 'declined';
  transfer_code: string;  // Claim code for recipient
  created_at: timestamptz;
}

// Ticket resale
interface TicketListing {
  ticket_id: uuid;
  seller_user_id: uuid;
  listing_price_cents: int;
  status: 'active' | 'sold' | 'cancelled';
  sold_to_user_id?: uuid;
  created_at: timestamptz;
}
```

---

## Wallet Pass Integration

### Apple Wallet (.pkpass)
```typescript
// Generate Apple Wallet pass
async function generateAppleWalletPass(ticket: Ticket) {
  // 1. Create pass data
  const passData = {
    formatVersion: 1,
    passTypeIdentifier: 'pass.com.liventix.ticket',
    serialNumber: ticket.id,
    teamIdentifier: 'LIVENTIX_TEAM_ID',
    organizationName: 'Liventix',
    description: event.title,
    
    // Barcode (QR code)
    barcode: {
      message: ticket.qr_code,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
    },
    
    // Visual design
    logoText: 'Liventix',
    foregroundColor: 'rgb(255, 255, 255)',
    backgroundColor: 'rgb(0, 0, 0)',
    
    // Event info fields
    eventTicket: {
      primaryFields: [{ key: 'event', label: 'Event', value: event.title }],
      secondaryFields: [
        { key: 'date', label: 'Date', value: formatDate(event.start_at) },
        { key: 'location', label: 'Location', value: event.venue }
      ],
      auxiliaryFields: [
        { key: 'tier', label: 'Tier', value: ticket.tier.name },
        { key: 'gate', label: 'Gate', value: 'A' }
      ],
    },
  };
  
  // 2. Sign pass with certificates
  // 3. Package as .pkpass file
  // 4. Upload to storage
  // 5. Return pass URL
}
```

### Google Wallet
```typescript
// Generate Google Wallet pass
async function generateGoogleWalletPass(ticket: Ticket) {
  const passObject = {
    id: `${ISSUER_ID}.${ticket.id}`,
    classId: `${ISSUER_ID}.event_ticket`,
    state: 'ACTIVE',
    
    // Barcode
    barcode: {
      type: 'QR_CODE',
      value: ticket.qr_code,
    },
    
    // Event details
    eventName: { defaultValue: { language: 'en-US', value: event.title }},
    venue: { defaultValue: { language: 'en-US', value: event.venue }},
    dateTime: {
      start: event.start_at,
      end: event.end_at,
    },
    
    // Ticket info
    seatInfo: { seat: { defaultValue: { language: 'en-US', value: ticket.tier.name }}},
  };
  
  // Generate JWT and return save URL
  return `https://pay.google.com/gp/v/save/${generateJWT(passObject)}`;
}
```

---

## Edge Functions & API

### Ticket-related Edge Functions

#### `supabase/functions/checkout/index.ts`
**Purpose**: Create Stripe checkout session
```typescript
export async function handler(req: Request) {
  const { event_id, items, guest_code } = await req.json();
  
  // 1. Validate ticket availability
  // 2. Apply guest code discount
  // 3. Calculate fees
  // 4. Create Stripe checkout session
  // 5. Return session URL
}
```

#### `supabase/functions/stripe-webhook/index.ts`
**Purpose**: Process Stripe webhooks
```typescript
export async function handler(req: Request) {
  const event = await validateStripeSignature(req);
  
  switch (event.type) {
    case 'checkout.session.completed':
      await issueTickets(event.data.object);
      await sendConfirmationEmail(event.data.object);
      break;
      
    case 'charge.refunded':
      await processRefund(event.data.object);
      break;
  }
}
```

#### `supabase/functions/generate-qr/index.ts`
**Purpose**: Generate unique QR codes for tickets
```typescript
export async function handler(req: Request) {
  const { ticket_id } = await req.json();
  
  // 1. Generate unique code
  const qrCode = generateUniqueQRCode();
  
  // 2. Update ticket record
  await updateTicket(ticket_id, { qr_code: qrCode });
  
  // 3. Return QR code
  return { qr_code: qrCode };
}
```

---

## Security & Fraud Prevention

### QR Code Security
```typescript
// QR codes are cryptographically signed
const qr_code = `${ticket.id}:${hmac_sha256(ticket.id, SECRET_KEY)}`;

// Validation
function validateQRCode(scannedCode: string): boolean {
  const [ticketId, signature] = scannedCode.split(':');
  const expectedSignature = hmac_sha256(ticketId, SECRET_KEY);
  return signature === expectedSignature;
}
```

### Duplicate Prevention
```sql
-- Check for duplicate scans
SELECT redeemed_at 
FROM tickets 
WHERE qr_code = $1 AND redeemed_at IS NOT NULL;

-- If redeemed_at exists, it's a duplicate
```

### Ticket Transfer Validation
```typescript
// Verify transfer ownership
function canTransferTicket(ticket: Ticket, userId: string): boolean {
  // 1. User owns ticket
  if (ticket.owner_user_id !== userId) return false;
  
  // 2. Ticket not redeemed
  if (ticket.redeemed_at) return false;
  
  // 3. Event allows transfers
  if (ticket.event.no_transfers) return false;
  
  // 4. Within transfer window
  if (ticket.event.start_at < addDays(now(), -7)) return false;
  
  return true;
}
```

---

## Analytics & Reporting

### Ticket Sales Analytics

```typescript
// Real-time sales metrics
interface TicketAnalytics {
  total_sold: number;
  total_revenue_cents: number;
  by_tier: Array<{
    tier_id: string;
    tier_name: string;
    sold: number;
    available: number;
    revenue_cents: number;
  }>;
  sales_over_time: Array<{
    date: string;
    tickets_sold: number;
    revenue_cents: number;
  }>;
  redemption_rate: number;  // % of tickets scanned
  guest_code_usage: Array<{
    code: string;
    uses: number;
    discount_applied_cents: number;
  }>;
}
```

### Organizer Dashboard Queries
```sql
-- Total tickets sold
SELECT COUNT(*) as total_sold, SUM(price_cents) as revenue
FROM tickets t
JOIN ticket_tiers tt ON t.tier_id = tt.id
WHERE t.event_id = $1 AND t.status = 'issued';

-- Sales by tier
SELECT 
  tt.name,
  COUNT(t.id) as sold,
  tt.quantity - COUNT(t.id) as available,
  SUM(tt.price_cents) as revenue
FROM ticket_tiers tt
LEFT JOIN tickets t ON tt.id = t.tier_id AND t.status = 'issued'
WHERE tt.event_id = $1
GROUP BY tt.id, tt.name, tt.quantity;

-- Redemption rate
SELECT 
  COUNT(*) as total_tickets,
  COUNT(redeemed_at) as redeemed,
  (COUNT(redeemed_at)::float / NULLIF(COUNT(*), 0) * 100) as redemption_rate
FROM tickets
WHERE event_id = $1;
```

---

## Testing Checklist

### Ticket Purchase Flow
- [ ] Browse events and view ticket tiers
- [ ] Select multiple tiers with quantities
- [ ] Apply valid guest code
- [ ] Invalid guest code shows error
- [ ] Expired guest code rejected
- [ ] Checkout session creates order
- [ ] Payment success issues tickets
- [ ] QR codes generated uniquely
- [ ] Confirmation email sent
- [ ] Tickets appear in wallet

### Ticket Scanning
- [ ] Valid ticket scans successfully
- [ ] Duplicate scan shows warning
- [ ] Invalid QR code rejected
- [ ] Wrong event ticket rejected
- [ ] Cancelled ticket rejected
- [ ] Scan logs created correctly
- [ ] Attendee info displayed
- [ ] Real-time analytics updated

### Edge Cases
- [ ] Sold out tiers
- [ ] Sales start/end times enforced
- [ ] Max per order limit
- [ ] Guest code usage limit
- [ ] Concurrent purchases (race conditions)
- [ ] Payment failure handling
- [ ] Refund processing

---

All ticketing system files are production-ready! 🎟️
