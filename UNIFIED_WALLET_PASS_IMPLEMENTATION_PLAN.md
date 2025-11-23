# 🎫 Unified Wallet Pass Implementation Plan

## Overview

**Goal:** Create a single Supabase Edge Function that generates both Apple Wallet (.pkpass) and Google Wallet passes using a unified endpoint.

**Endpoint:** `POST /functions/v1/generate-ticket-pass?platform=apple|google`

**Status:** 📋 **PLANNING PHASE** - Implementation deferred

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (iOS/Android/Web)                 │
│                                                              │
│  Platform Detection:                                         │
│  - iOS Native → platform=apple                              │
│  - iOS Safari → platform=apple                              │
│  - Android Native → platform=google                         │
│  - Android Chrome → platform=google                         │
│  - Web (other) → platform=google (fallback)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│         Supabase Edge Function                               │
│         /functions/v1/generate-ticket-pass                   │
│                                                              │
│  1. Parse platform query param                               │
│  2. Validate request (ticket_id, user_id)                   │
│  3. Fetch ticket with full event details                    │
│  4. Validate user owns ticket                               │
│  5. Branch on platform:                                     │
│     ├─ platform=apple → generateApplePass()                 │
│     └─ platform=google → generateGooglePass()               │
│  6. Return platform-specific response                       │
└─────────────────────────────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                ↓                     ↓
    ┌──────────────────┐   ┌──────────────────┐
    │  Apple Wallet    │   │  Google Wallet   │
    │  (.pkpass)       │   │  (JWT URL)       │
    └──────────────────┘   └──────────────────┘
```

---

## File Structure

```
supabase/functions/
├── generate-ticket-pass/
│   ├── index.ts                    # Main unified function
│   ├── apple-pass-generator.ts     # Apple Wallet logic
│   ├── google-pass-generator.ts    # Google Wallet logic
│   ├── shared-types.ts             # Shared TypeScript types
│   └── _shared/                    # Shared utilities (if needed)
│       └── cors.ts                 # CORS headers
│
src/components/tickets/
├── AddToWalletButton.tsx           # Unified wallet button
├── AddToAppleWalletButton.tsx      # Apple-specific (optional)
└── AddToGoogleWalletButton.tsx     # Google-specific (optional)
```

---

## Implementation Phases

### Phase 1: Foundation & Setup ⏱️ Week 1

**Tasks:**
1. ✅ Create Edge Function skeleton
2. ✅ Set up shared types and interfaces
3. ✅ Implement unified ticket fetching and validation
4. ✅ Add platform parameter parsing
5. ✅ Set up error handling and CORS
6. ✅ Create frontend button component skeleton

**Deliverables:**
- Edge Function structure in place
- Basic request/response flow working
- Frontend button component (disabled/placeholder)

---

### Phase 2: Google Wallet Implementation ⏱️ Week 2

**Why Google first?** Simpler implementation, no certificates needed, faster to test.

**Tasks:**
1. Set up Google Cloud project
2. Enable Google Pay Passes API
3. Create service account
4. Get Issuer ID from Google Pay Console
5. Implement JWT generation (using djwt library)
6. Create EventTicketClass template
7. Create EventTicketObject
8. Generate save-to-wallet URL
9. Test on Android device
10. Test on iOS Safari (web)

**Deliverables:**
- Google Wallet pass generation working
- Passes save successfully to Google Wallet
- QR codes scan correctly

**Dependencies:**
- `djwt` library for Deno
- Google Cloud service account key
- Google Pay Passes API enabled

**Environment Variables:**
```
GOOGLE_WALLET_ISSUER_ID=1234567890123456789
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

---

### Phase 3: Apple Wallet Implementation ⏱️ Week 3-4

**Why Apple second?** More complex, requires certificates and pass signing.

**Tasks:**
1. Choose implementation approach:
   - **Option A:** Use PassKit service (WalletPasses.io, PassKit.com)
   - **Option B:** Build custom signing (complex)
2. If Option A (recommended):
   - Sign up for service
   - Get API credentials
   - Implement service integration
3. If Option B (custom):
   - Create Pass Type ID in Apple Developer
   - Generate Pass Type ID certificate
   - Download WWDR certificate
   - Implement pass JSON structure
   - Implement pass signing
   - Implement pass zipping
4. Test on iOS device
5. Test on iOS Safari (web)

**Deliverables:**
- Apple Wallet pass generation working
- Passes save successfully to Apple Wallet
- QR codes scan correctly

**Dependencies:**
- Apple Developer Program ($99/year)
- Pass Type ID certificate OR PassKit service account

**Environment Variables (if custom):**
```
APPLE_PASS_TYPE_ID=pass.com.liventix.app.eventtickets
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_PASS_CERTIFICATE_P12=base64_encoded_cert
APPLE_PASS_CERT_PASSWORD=certificate_password
APPLE_WWDR_CERTIFICATE=base64_encoded_wwdr_cert
```

**OR (if using service):**
```
WALLET_PASSES_API_KEY=your_api_key
WALLET_PASSES_API_URL=https://api.walletpasses.io
```

---

### Phase 4: Frontend Integration ⏱️ Week 4

**Tasks:**
1. Create unified `AddToWalletButton` component
2. Implement platform detection (iOS/Android/Web)
3. Add loading states and error handling
4. Integrate with ticket detail pages
5. Add success/error toasts
6. Test on all platforms

**Deliverables:**
- Unified wallet button component
- Platform-specific behavior
- Integrated into ticket pages

---

### Phase 5: Pass Updates & Notifications ⏱️ Week 5 (Optional)

**Tasks:**
1. Create pass update endpoint (for status changes)
2. Implement Apple Wallet update web service
3. Implement Google Wallet push notifications
4. Add database tracking columns
5. Test automatic updates

**Deliverables:**
- Passes update automatically when ticket status changes
- Notifications appear in wallets

---

## Detailed Implementation Steps

### Step 1: Create Edge Function Structure

**File:** `supabase/functions/generate-ticket-pass/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { generateApplePass } from './apple-pass-generator.ts';
import { generateGooglePass } from './google-pass-generator.ts';
import type { TicketPassPayload } from './shared-types.ts';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse platform parameter
  const url = new URL(req.url);
  const platform = (url.searchParams.get('platform') || '').toLowerCase();

  if (!['apple', 'google'].includes(platform)) {
    return new Response(
      JSON.stringify({ 
        error: 'platform parameter required',
        message: 'Must be either "apple" or "google"',
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // Parse request body
    const { ticket_id, user_id } = await req.json();

    if (!ticket_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'ticket_id and user_id required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch ticket with full details
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        id,
        qr_code,
        serial_no,
        attendee_name,
        status,
        ticket_tiers (
          name,
          event_id,
          events (
            title,
            start_at,
            venue_name,
            venue_address,
            cover_image_url
          )
        )
      `)
      .eq('id', ticket_id)
      .eq('user_id', user_id)
      .single();

    if (ticketError || !ticket) {
      console.error('[generate-ticket-pass] Ticket not found:', ticketError);
      return new Response(
        JSON.stringify({ error: 'Ticket not found or access denied' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Build unified payload
    const payload: TicketPassPayload = {
      ticketId: ticket.id,
      qrCode: ticket.qr_code,
      serialNumber: ticket.serial_no,
      attendeeName: ticket.attendee_name || 'Guest',
      ticketTier: ticket.ticket_tiers?.name || 'General Admission',
      eventId: ticket.ticket_tiers?.event_id || '',
      eventTitle: ticket.ticket_tiers?.events?.title || 'Event',
      eventDate: ticket.ticket_tiers?.events?.start_at || '',
      venueName: ticket.ticket_tiers?.events?.venue_name || '',
      venueAddress: ticket.ticket_tiers?.events?.venue_address || '',
      coverImageUrl: ticket.ticket_tiers?.events?.cover_image_url || '',
      status: ticket.status,
    };

    // Generate platform-specific pass
    if (platform === 'apple') {
      const pkpass = await generateApplePass(payload);
      
      return new Response(pkpass, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.apple.pkpass',
          'Content-Disposition': `attachment; filename="ticket-${ticket.id}.pkpass"`,
        },
      });
    }

    if (platform === 'google') {
      const walletUrl = await generateGooglePass(payload);
      
      return new Response(
        JSON.stringify({ 
          success: true,
          walletUrl,
          addToWalletUrl: walletUrl, // For compatibility
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('[generate-ticket-pass] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
```

### Step 2: Create Shared Types

**File:** `supabase/functions/generate-ticket-pass/shared-types.ts`

```typescript
/**
 * Unified payload structure for both Apple and Google Wallet passes
 */
export interface TicketPassPayload {
  ticketId: string;
  qrCode: string;
  serialNumber: string;
  attendeeName: string;
  ticketTier: string;
  eventId: string;
  eventTitle: string;
  eventDate: string; // ISO 8601 format
  venueName: string;
  venueAddress: string;
  coverImageUrl: string;
  status: string;
}

/**
 * Response format for Google Wallet
 */
export interface GoogleWalletResponse {
  success: boolean;
  walletUrl: string;
  addToWalletUrl: string;
}

/**
 * Response format for Apple Wallet (binary .pkpass file)
 * No interface needed - returns Uint8Array directly
 */
```

### Step 3: Google Wallet Generator (Stub)

**File:** `supabase/functions/generate-ticket-pass/google-pass-generator.ts`

```typescript
import type { TicketPassPayload } from './shared-types.ts';

/**
 * Generate Google Wallet pass and return save-to-wallet URL
 * 
 * Implementation steps:
 * 1. Load service account key from environment
 * 2. Generate JWT token
 * 3. Create/update EventTicketClass
 * 4. Create EventTicketObject
 * 5. Build save-to-wallet URL with JWT
 */
export async function generateGooglePass(
  payload: TicketPassPayload
): Promise<string> {
  // TODO: Implement Google Wallet pass generation
  // See GOOGLE_WALLET_IMPLEMENTATION_GUIDE.md for details
  
  throw new Error('Google Wallet pass generation not yet implemented');
}
```

### Step 4: Apple Wallet Generator (Stub)

**File:** `supabase/functions/generate-ticket-pass/apple-pass-generator.ts`

```typescript
import type { TicketPassPayload } from './shared-types.ts';

/**
 * Generate Apple Wallet .pkpass file
 * 
 * Implementation steps:
 * 1. Load certificates from environment
 * 2. Build pass.json structure
 * 3. Add assets (icon, logo, etc.)
 * 4. Sign pass with certificates
 * 5. Zip into .pkpass file
 * 
 * OR (if using service):
 * 1. Call PassKit service API
 * 2. Return generated .pkpass file
 */
export async function generateApplePass(
  payload: TicketPassPayload
): Promise<Uint8Array> {
  // TODO: Implement Apple Wallet pass generation
  // See APPLE_WALLET_IMPLEMENTATION_GUIDE.md for details
  
  throw new Error('Apple Wallet pass generation not yet implemented');
}
```

### Step 5: Frontend Unified Button Component

**File:** `src/components/tickets/AddToWalletButton.tsx`

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet, Download, Check, Apple } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface AddToWalletButtonProps {
  ticketId: string;
  className?: string;
}

export function AddToWalletButton({ 
  ticketId, 
  className 
}: AddToWalletButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Detect platform
  const platform = Capacitor.isNativePlatform()
    ? Capacitor.getPlatform() === 'ios' ? 'apple' : 'google'
    : 'google'; // Web default to Google (works on all browsers)

  const handleAddToWallet = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to add tickets to your wallet',
        variant: 'destructive',
      });
      return;
    }

    setIsAdding(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ticket-pass?platform=${platform}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            ticket_id: ticketId,
            user_id: user.id,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate pass');
      }

      if (platform === 'apple') {
        // Handle .pkpass file download
        const blob = await response.blob();
        
        // Try to use PassKit API (iOS Safari) or Capacitor plugin
        if (Capacitor.isNativePlatform()) {
          const { PassKit } = await import('@capacitor/passkit');
          const passData = await blob.arrayBuffer();
          const result = await PassKit.addPass({
            passData: Array.from(new Uint8Array(passData)),
          });
          
          if (result.added) {
            setIsAdded(true);
            toast({
              title: 'Added to Wallet',
              description: 'Your ticket has been added to Apple Wallet',
            });
          } else {
            throw new Error('Failed to add pass');
          }
        } else {
          // Web fallback: download the file
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ticket-${ticketId}.pkpass`;
          a.click();
          URL.revokeObjectURL(url);
          
          toast({
            title: 'Pass downloaded',
            description: 'Open the .pkpass file to add to Apple Wallet',
          });
        }
      } else {
        // Handle Google Wallet URL
        const { walletUrl } = await response.json();
        
        // Open Google Wallet save URL
        window.open(walletUrl, '_blank');
        
        setIsAdded(true);
        toast({
          title: 'Opening Google Wallet',
          description: 'Add your ticket to Google Wallet',
        });
      }
    } catch (error: any) {
      console.error('Error adding to wallet:', error);
      toast({
        title: 'Failed to add to Wallet',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  if (isAdded) {
    return (
      <Button
        variant="outline"
        disabled
        className={className}
      >
        <Check className="w-4 h-4 mr-2" />
        Added to Wallet
      </Button>
    );
  }

  return (
    <Button
      onClick={handleAddToWallet}
      disabled={isAdding}
      className={className}
    >
      {isAdding ? (
        <>
          <Download className="w-4 h-4 mr-2 animate-spin" />
          Adding...
        </>
      ) : (
        <>
          {platform === 'apple' ? (
            <Apple className="w-4 h-4 mr-2" />
          ) : (
            <Wallet className="w-4 h-4 mr-2" />
          )}
          Add to {platform === 'apple' ? 'Apple' : 'Google'} Wallet
        </>
      )}
    </Button>
  );
}
```

---

## Database Schema Updates

### Optional: Add Wallet Tracking

```sql
-- Track wallet pass generation
ALTER TABLE ticketing.tickets
ADD COLUMN IF NOT EXISTS apple_wallet_added_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_wallet_added_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_wallet_object_id TEXT,
ADD COLUMN IF NOT EXISTS apple_pass_serial_number TEXT;

-- Indexes for pass updates
CREATE INDEX IF NOT EXISTS idx_tickets_google_wallet_object 
ON ticketing.tickets(google_wallet_object_id) 
WHERE google_wallet_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_apple_pass_serial 
ON ticketing.tickets(apple_pass_serial_number) 
WHERE apple_pass_serial_number IS NOT NULL;
```

---

## Environment Variables Checklist

### Required for Google Wallet
```bash
# Google Cloud Setup
GOOGLE_WALLET_ISSUER_ID=1234567890123456789
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

### Required for Apple Wallet (Custom Implementation)
```bash
# Apple Developer Certificates
APPLE_PASS_TYPE_ID=pass.com.liventix.app.eventtickets
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_PASS_CERTIFICATE_P12=base64_encoded_cert
APPLE_PASS_CERT_PASSWORD=certificate_password
APPLE_WWDR_CERTIFICATE=base64_encoded_wwdr_cert
```

### OR Required for Apple Wallet (Service-based)
```bash
# PassKit Service (choose one)
WALLET_PASSES_API_KEY=your_api_key
# OR
PASSKIT_API_KEY=your_api_key
# OR
PASSNINJA_API_KEY=your_api_key
```

---

## Testing Checklist

### Google Wallet Testing
- [ ] Pass generation succeeds
- [ ] Wallet URL opens correctly
- [ ] Pass saves to Google Wallet (Android)
- [ ] Pass saves to Google Wallet (iOS Safari)
- [ ] QR code scans correctly
- [ ] Event details display correctly
- [ ] Cover image loads
- [ ] Multiple passes can be added
- [ ] Pass updates work (if implemented)

### Apple Wallet Testing
- [ ] Pass generation succeeds
- [ ] .pkpass file downloads
- [ ] Pass opens in Wallet app (iOS native)
- [ ] Pass opens in Wallet app (iOS Safari)
- [ ] QR code scans correctly
- [ ] Event details display correctly
- [ ] Images render correctly
- [ ] Multiple passes can be added
- [ ] Pass updates work (if implemented)

### Cross-Platform Testing
- [ ] iOS native → Apple Wallet
- [ ] iOS Safari → Apple Wallet
- [ ] Android native → Google Wallet
- [ ] Android Chrome → Google Wallet
- [ ] Desktop Chrome → Google Wallet (web fallback)
- [ ] Desktop Safari → Google Wallet (web fallback)

---

## Deployment Steps

### 1. Set Up Environment Variables

```bash
# Add to Supabase secrets
supabase secrets set GOOGLE_WALLET_ISSUER_ID="1234567890123456789"
supabase secrets set GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# For Apple Wallet (if using service)
supabase secrets set WALLET_PASSES_API_KEY="your_api_key"

# OR (if custom Apple implementation)
supabase secrets set APPLE_PASS_TYPE_ID="pass.com.liventix.app.eventtickets"
supabase secrets set APPLE_TEAM_ID="YOUR_TEAM_ID"
# ... etc
```

### 2. Deploy Edge Function

```bash
supabase functions deploy generate-ticket-pass
```

### 3. Test Function

```bash
# Test Google Wallet
curl -X POST \
  "https://your-project.supabase.co/functions/v1/generate-ticket-pass?platform=google" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ticket_id": "...", "user_id": "..."}'

# Test Apple Wallet
curl -X POST \
  "https://your-project.supabase.co/functions/v1/generate-ticket-pass?platform=apple" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ticket_id": "...", "user_id": "..."}' \
  --output test.pkpass
```

---

## Implementation Priority

### Recommended Order

1. **Phase 1: Foundation** (Week 1)
   - Set up function structure
   - Implement ticket fetching/validation
   - Create frontend button skeleton

2. **Phase 2: Google Wallet** (Week 2)
   - Implement Google Wallet first (simpler)
   - Test on Android and iOS Safari
   - This gives you 80% coverage

3. **Phase 3: Apple Wallet** (Week 3-4)
   - Implement Apple Wallet (more complex)
   - Test on iOS native and Safari
   - This completes coverage

4. **Phase 4: Polish** (Week 5)
   - Pass updates
   - Error handling improvements
   - Analytics tracking

---

## Cost Estimate

### Google Wallet
- **Setup:** Free (GCP free tier)
- **API Calls:** Free (within quotas)
- **Total:** $0/month

### Apple Wallet
- **Option A (Service):** $50-200/month (PassKit.com, WalletPasses.io)
- **Option B (Custom):** $99/year (Apple Developer Program only)
- **Total:** $99/year or $50-200/month

### Development Time
- **Google Wallet:** 1 week
- **Apple Wallet:** 2-3 weeks
- **Total:** 3-4 weeks

---

## Success Criteria

✅ **Functionality:**
- Both platforms generate passes successfully
- Passes save to respective wallets
- QR codes scan correctly
- Event details display correctly

✅ **User Experience:**
- One button for all platforms
- Automatic platform detection
- Clear success/error messages
- Fast generation (< 2 seconds)

✅ **Technical:**
- Unified codebase
- Proper error handling
- Secure credential management
- Scalable architecture

---

## Next Steps (When Ready to Implement)

1. ✅ Review this plan
2. ✅ Set up Google Cloud account (for Google Wallet)
3. ✅ Set up Apple Developer account (for Apple Wallet)
4. ✅ Create Edge Function skeleton
5. ✅ Implement Google Wallet first
6. ✅ Test Google Wallet thoroughly
7. ✅ Implement Apple Wallet
8. ✅ Test Apple Wallet thoroughly
9. ✅ Integrate frontend button
10. ✅ Deploy to production

---

## Resources

- **Google Wallet:**
  - [Google Pay Passes API Docs](https://developers.google.com/wallet/generic)
  - [Google Cloud Console](https://console.cloud.google.com/)
  - [Google Pay & Wallet Console](https://pay.google.com/business/console)

- **Apple Wallet:**
  - [PassKit Documentation](https://developer.apple.com/documentation/passkit)
  - [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/passTypeId)
  - [PassKit Generator (Node.js)](https://github.com/alexandercerutti/passkit-generator)

- **Services:**
  - [WalletPasses.io](https://walletpasses.io) - API-based service
  - [PassKit.com](https://passkit.com) - Enterprise solution
  - [PassNinja](https://passninja.com) - Simple, affordable

---

**Status:** 📋 Ready for implementation when needed

