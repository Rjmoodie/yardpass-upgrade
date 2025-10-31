# 🎯 Conversion Tracking Integration Guide

## Overview

Your YardPass ad platform now includes **industry-standard conversion tracking** with:

- ✅ **7-day last-click attribution** (preferred)
- ✅ **1-day view-through attribution** (fallback)
- ✅ **Request-level deduplication** (prevents double-counting)
- ✅ **Multi-channel source tracking** (feed, checkout, profile, etc.)
- ✅ **Device type detection** (mobile, tablet, desktop)
- ✅ **ROAS calculation** (revenue / spend)

---

## 🚀 Quick Start: Track Ticket Purchases

### 1. Import the Tracking Library

```typescript
import { trackTicketPurchase, getOrCreateSessionId } from '@/lib/conversionTracking';
```

### 2. Add to Your Checkout Success Handler

```typescript
// In your ticket purchase component (e.g., CheckoutPage.tsx)
async function handleCheckoutSuccess(ticket: Ticket, priceCents: number) {
  try {
    // Get current session ID
    const sessionId = getOrCreateSessionId();
    
    // Get current user (if authenticated)
    const { data: { user } } = await supabase.auth.getUser();
    
    // Track the conversion
    const result = await trackTicketPurchase({
      userId: user?.id || null,
      sessionId: sessionId,
      ticketId: ticket.id,
      priceCents: priceCents,
      source: 'checkout'
    });
    
    // Log the attribution result
    if (result.success) {
      console.log('✅ Conversion attributed:', result.attributionModel);
      // attribution_model will be:
      // - 'last_click_7d' if user clicked an ad in the last 7 days
      // - 'view_through_1d' if user saw an ad in the last 1 day (no click)
      // - 'none' if no ad exposure found
    }
  } catch (err) {
    // Conversion tracking failure should NOT break checkout
    console.error('Conversion tracking failed:', err);
  }
}
```

---

## 📦 Integration Examples

### Example 1: Ticket Purchase Flow

```typescript
// src/features/tickets/CheckoutPage.tsx

import { trackTicketPurchase, getOrCreateSessionId } from '@/lib/conversionTracking';
import { supabase } from '@/lib/supabaseClient';

export function CheckoutPage() {
  const handlePaymentSuccess = async (ticket: Ticket) => {
    // 1. Complete the payment/ticket creation
    const { data: newTicket, error } = await supabase
      .from('tickets')
      .insert({ /* ... */ })
      .select()
      .single();
    
    if (error || !newTicket) {
      console.error('Ticket creation failed:', error);
      return;
    }
    
    // 2. Track the conversion (non-blocking)
    const { data: { user } } = await supabase.auth.getUser();
    
    trackTicketPurchase({
      userId: user?.id || null,
      sessionId: getOrCreateSessionId(),
      ticketId: newTicket.id,
      priceCents: newTicket.price_cents,
      source: 'checkout'
    }).catch(err => {
      // Log but don't break the flow
      console.error('Conversion tracking failed:', err);
    });
    
    // 3. Show success message
    showSuccessToast('Ticket purchased!');
    navigate('/tickets/' + newTicket.id);
  };
  
  return (
    <StripeCheckout onSuccess={handlePaymentSuccess} />
  );
}
```

### Example 2: Track User Signups

```typescript
// src/features/auth/SignupPage.tsx

import { trackSignup, getOrCreateSessionId } from '@/lib/conversionTracking';

export function SignupPage() {
  const handleSignup = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    
    if (error || !data.user) {
      console.error('Signup failed:', error);
      return;
    }
    
    // Track signup conversion (if user came from an ad)
    await trackSignup({
      userId: data.user.id,
      sessionId: getOrCreateSessionId(),
      source: 'feed', // or 'event_detail', 'profile', etc.
      valueCents: 0 // Optional: assign value to signups
    });
    
    navigate('/onboarding');
  };
  
  return (
    <form onSubmit={handleSignup}>
      {/* ... */}
    </form>
  );
}
```

### Example 3: Track Custom Conversions

```typescript
// src/features/events/RSVPButton.tsx

import { trackConversion, getOrCreateSessionId } from '@/lib/conversionTracking';

export function RSVPButton({ eventId }: { eventId: string }) {
  const handleRSVP = async () => {
    // 1. Create the RSVP
    const { error } = await supabase
      .from('event_rsvps')
      .insert({ event_id: eventId, user_id: userId });
    
    if (error) return;
    
    // 2. Track as a conversion (if you want to measure RSVP value)
    const { data: { user } } = await supabase.auth.getUser();
    
    await trackConversion({
      userId: user?.id || null,
      sessionId: getOrCreateSessionId(),
      kind: 'other',
      valueCents: 0, // Or assign a value
      source: 'event_detail'
    });
  };
  
  return <button onClick={handleRSVP}>RSVP</button>;
}
```

---

## 🧪 Testing & Validation

### Test Plan

Run through this checklist to verify conversion tracking works:

| Test Case | Expected Result |
|-----------|----------------|
| **Click → Purchase (same day)** | `attribution_model: 'last_click_7d'` |
| **Click → Purchase (6 days later)** | `attribution_model: 'last_click_7d'` |
| **Click → Purchase (8 days later)** | `attribution_model: 'none'` |
| **View → Purchase (no click, same day)** | `attribution_model: 'view_through_1d'` |
| **View → Purchase (no click, 2 days later)** | `attribution_model: 'none'` |
| **Purchase with no ad exposure** | `attribution_model: 'none'` |
| **Double submission (same request_id)** | Only 1 conversion logged (deduped) |

### Manual Test Script

```sql
-- 1. Check if conversion was logged
SELECT 
  id,
  kind,
  value_cents,
  attribution_model,
  conversion_source,
  created_at
FROM campaigns.ad_conversions
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check attribution linkage
SELECT 
  conv.id AS conversion_id,
  conv.attribution_model,
  conv.value_cents / 100.0 AS revenue_dollars,
  clk.id AS click_id,
  imp.id AS impression_id,
  c.name AS campaign_name
FROM campaigns.ad_conversions conv
LEFT JOIN campaigns.ad_clicks clk ON clk.id = conv.click_id
LEFT JOIN campaigns.ad_impressions imp ON imp.id = conv.impression_id
LEFT JOIN campaigns.campaigns c ON c.id = COALESCE(clk.campaign_id, imp.campaign_id)
ORDER BY conv.created_at DESC
LIMIT 10;

-- 3. Check conversion metrics in analytics
SELECT 
  campaign_id,
  day,
  impressions,
  clicks,
  conversions,
  conversion_value_cents / 100.0 AS revenue_dollars,
  ctr,
  cvr,
  roas
FROM public.analytics_campaign_daily_mv
WHERE conversions > 0
ORDER BY day DESC;
```

---

## 📊 Dashboard Metrics

After implementing conversion tracking, your analytics dashboard will show:

### Key Performance Indicators

- **CTR (Click-Through Rate)**: `(clicks / impressions) × 100`
- **CVR (Conversion Rate)**: `(conversions / clicks) × 100`
- **CPA (Cost Per Acquisition)**: `spend / conversions`
- **ROAS (Return on Ad Spend)**: `revenue / spend`
- **View-Through Rate**: `(view_conversions / total_conversions) × 100`

### Example Dashboard Card

```
┌─────────────────────────────────────┐
│ Conversions                         │
│ 27                         ▲ 125%  │
│                                     │
│ Attribution Breakdown:              │
│ • Last-click (7d):    22 (81%)     │
│ • View-through (1d):   5 (19%)     │
│                                     │
│ Revenue: $675.00                    │
│ ROAS: 4.5x                          │
└─────────────────────────────────────┘
```

---

## 🔧 Advanced Configuration

### Custom Attribution Windows

To change attribution windows (e.g., 3-day click, 6-hour view), modify the RPC:

```sql
-- In supabase/migrations/20251028010000_enhance_conversion_tracking.sql

-- Change this line:
AND c.created_at >= p_occurred_at - INTERVAL '7 days'
-- To:
AND c.created_at >= p_occurred_at - INTERVAL '3 days'

-- And this line:
AND i.created_at >= p_occurred_at - INTERVAL '1 day'
-- To:
AND i.created_at >= p_occurred_at - INTERVAL '6 hours'
```

### Server-Side Postback API

For external integrations (Shopify, Zapier, etc.), expose an endpoint:

```typescript
// supabase/functions/conversion-postback/index.ts

import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const { user_id, ticket_id, price_cents, source } = await req.json();
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const { data, error } = await supabase.rpc('track_ticket_conversion', {
    p_user_id: user_id,
    p_session_id: 'external',
    p_ticket_id: ticket_id,
    p_ticket_price_cents: price_cents,
    p_conversion_source: source || 'api'
  });
  
  return new Response(JSON.stringify({ success: !error, data }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

---

## 🛡️ Privacy & Compliance

### GDPR/CCPA Considerations

- ✅ **No PII stored**: User IDs are hashed references
- ✅ **Session-based tracking**: No cookies required
- ✅ **User consent**: Add consent check before tracking
- ✅ **Data deletion**: Conversions deleted when user account deleted

### Add Consent Check

```typescript
import { hasUserConsent } from '@/lib/consent';

async function trackIfConsented(conversionData) {
  if (!hasUserConsent('advertising')) {
    console.log('User has not consented to ad tracking');
    return;
  }
  
  await trackConversion(conversionData);
}
```

---

## 📈 Next Steps

1. **Deploy migrations**: Run the new migration files
2. **Integrate tracking**: Add `trackTicketPurchase()` to your checkout flow
3. **Test attribution**: Use the test plan above
4. **Monitor metrics**: Check the analytics dashboard
5. **Optimize campaigns**: Use ROAS/CPA to optimize ad spend

---

## 🆘 Troubleshooting

### "No attribution found" (attribution_model: 'none')

**Causes:**
- User didn't interact with any ads
- Attribution window expired (>7 days for click, >1 day for view)
- Session ID mismatch (check `getOrCreateSessionId()`)

**Fix:**
```typescript
// Ensure session ID is consistent
const sessionId = getOrCreateSessionId();
console.log('Using session ID:', sessionId);
```

### Conversions not showing in dashboard

**Causes:**
- Materialized view not refreshed
- Conversion occurred today (view shows yesterday's data)

**Fix:**
```sql
-- Refresh the materialized view
SELECT public.refresh_analytics();

-- Check raw conversions
SELECT * FROM campaigns.ad_conversions 
WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## 📚 Additional Resources

- [Attribution Models Explained](https://support.google.com/google-ads/answer/6259715)
- [IAB Viewability Standards](https://www.iab.com/guidelines/viewability/)
- [GDPR Compliance Guide](https://gdpr.eu/)

---

**Questions?** Check the `CONVERSION_TRACKING_TESTING_GUIDE.md` for detailed test scenarios.




