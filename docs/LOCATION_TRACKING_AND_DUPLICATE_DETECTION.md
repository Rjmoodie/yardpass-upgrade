# Location Tracking & Duplicate Account Detection

## Overview

We now automatically capture and store user location data from Stripe checkout billing addresses, and use it to detect potential duplicate accounts during guest purchases.

---

## 🗺️ Location Storage (Stripe Webhook)

### Implementation
**File:** `supabase/functions/stripe-webhook/index.ts` (lines 180-225)

When a `checkout.session.completed` event is received, we:
1. Retrieve the full Stripe session with customer details
2. Extract the billing address
3. Store it in `user_profiles.location` as JSON

### Location Data Structure
```json
{
  "city": "Brooklyn",
  "state": "NY",
  "country": "US",
  "postal_code": "11238",
  "line1": "535 Carlton Ave"
}
```

### Example Log Flow
```
[STRIPE-WEBHOOK] Order status updated to 'paid'
[STRIPE-WEBHOOK] Storing user location from billing address - userId: abc-123, city: Brooklyn, country: US
[STRIPE-WEBHOOK] ✅ Location stored successfully
[STRIPE-WEBHOOK] Calling process-payment function
```

### Database Schema
The `user_profiles.location` field stores location as TEXT (JSON string):
```sql
SELECT location FROM public.user_profiles WHERE user_id = 'abc-123';
-- Returns: '{"city":"Brooklyn","state":"NY","country":"US","postal_code":"11238","line1":"535 Carlton Ave"}'
```

---

## 🔍 Duplicate Account Detection (Guest Checkout)

### Implementation
**File:** `supabase/functions/guest-checkout/index.ts` (lines 235-309)

When a guest tries to checkout with an email that already exists:
1. Look up the existing user by email (via `check_user_auth_method` RPC)
2. Compare their stored location with the location they're checking out from
3. Log any mismatches but **don't block** (could be traveling, moved, etc.)
4. Use the existing user's ID for the checkout (preventing duplicates)

### Example Log Flow
#### Same Person (Location Matches)
```
[guest-checkout] User already exists, performing duplicate check...
[guest-checkout] User exists, looking up full user data...
[guest-checkout] Location matches stored data - same person
[guest-checkout] Using existing user ID for checkout
```

#### Potential Different Person (Location Mismatch)
```
[guest-checkout] User already exists, performing duplicate check...
[guest-checkout] User exists, looking up full user data...
[guest-checkout] ⚠️ Location mismatch
  stored: { city: "Brooklyn", country: "US" }
  provided: { city: "Los Angeles", country: "US" }
[guest-checkout] Using existing user ID for checkout
```

### API Changes
The `guest-checkout` Edge Function now accepts optional location fields:

```typescript
interface GuestCheckoutRequest {
  event_id: string;
  items: { tier_id: string; quantity: number }[];
  contact_email: string;
  contact_name?: string;
  contact_phone?: string;
  city?: string;  // NEW: For duplicate detection
  country?: string;  // NEW: For duplicate detection
}
```

**Frontend:** `src/lib/ticketApi.ts` updated to support these fields (optional).

---

## 🎯 Use Cases

### 1. Prevent Duplicate Accounts
- **Before:** Same email = create new account or fail
- **After:** Same email = reuse existing account, log location differences

### 2. Analytics & Insights
```sql
-- Top cities buying tickets
SELECT 
  location->>'city' as city,
  location->>'country' as country,
  COUNT(*) as purchases
FROM public.user_profiles
WHERE location IS NOT NULL
GROUP BY location->>'city', location->>'country'
ORDER BY purchases DESC;
```

### 3. Personalized Feed
```sql
-- Show events near user's location
SELECT e.* 
FROM events e, user_profiles up
WHERE up.user_id = auth.uid()
  AND e.city = up.location->>'city'
ORDER BY e.start_at;
```

### 4. Fraud Detection
- Flag accounts with same email but vastly different locations
- Investigate rapid location changes
- Monitor for account takeover attempts

---

## 📊 Testing

### Test Scenario 1: New Guest Checkout
**Steps:**
1. Go to an event page (not signed in)
2. Click "Get Tickets"
3. Enter email, name, and select tickets
4. Complete Stripe checkout with billing address
5. Check webhook logs for location storage

**Expected Result:**
- Webhook logs show: `✅ Location stored successfully`
- Database has location JSON in `user_profiles.location`

### Test Scenario 2: Existing User Guest Checkout
**Steps:**
1. Use the same email from Test 1
2. Try to purchase tickets again (as a guest)
3. Check logs for duplicate detection

**Expected Result:**
- Logs show: `Location matches stored data - same person`
- Checkout proceeds with existing user ID
- No duplicate account created

### Test Scenario 3: Location Mismatch
**Steps:**
1. Use same email but different city in Stripe checkout
2. Check logs

**Expected Result:**
- Logs show: `⚠️ Location mismatch`
- Checkout still proceeds (no blocking)
- Data logged for review

---

## 🔧 Configuration

### Required Environment Variables
- `STRIPE_SECRET_KEY` - For accessing Stripe API
- `STRIPE_WEBHOOK_SECRET` - For verifying webhook signatures
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - For admin operations

### Deployed Functions
1. ✅ `stripe-webhook` - Captures location from Stripe
2. ✅ `guest-checkout` - Duplicate detection logic

---

## 📝 Notes

- **Non-blocking:** Location mismatches are logged but don't prevent checkout
- **Privacy:** Only city, state, country, and postal code are stored (no lat/lng)
- **Source of truth:** Stripe billing address (user-verified during payment)
- **Graceful degradation:** If location storage fails, checkout still succeeds

---

## 🚀 Future Enhancements

1. **Active Location Prompting:**
   - Ask users for location during signup (optional)
   - Use browser geolocation API for more accurate data

2. **Location-based Recommendations:**
   - "Events near you" feed
   - Email notifications for local events

3. **Multi-location Support:**
   - Store location history (timestamps)
   - Detect users who travel frequently

4. **Advanced Duplicate Detection:**
   - Use IP address hashing
   - Device fingerprinting
   - Behavioral analysis

---

**Last Updated:** January 15, 2025  
**Deployed:** ✅ Production

