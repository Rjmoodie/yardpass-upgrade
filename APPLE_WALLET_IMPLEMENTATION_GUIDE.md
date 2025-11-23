# 🎫 Apple Wallet Integration Guide for Event Tickets

## Overview

This guide covers implementing "Add to Apple Wallet" functionality for event tickets with QR codes. Apple Wallet uses PassKit and requires server-side pass generation.

---

## Prerequisites

### 1. Apple Developer Account Requirements

- ✅ **Apple Developer Program Membership** ($99/year)
- ✅ **Pass Type ID** (create in Apple Developer Portal)
- ✅ **Pass Type ID Certificate** (download and install)
- ✅ **WWDR Certificate** (Apple Worldwide Developer Relations)

### 2. Technical Requirements

- ✅ Server-side pass generation (Edge Function or API endpoint)
- ✅ Pass signing with certificates
- ✅ Pass updates endpoint (for ticket status changes)
- ✅ Frontend PassKit integration

---

## Step 1: Apple Developer Setup

### 1.1 Create Pass Type ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/passTypeId)
2. Click **+** to create new Pass Type ID
3. **Description:** `Liventix Event Tickets`
4. **Identifier:** `pass.com.liventix.app.eventtickets` (must match your bundle ID pattern)
5. **Register** the Pass Type ID

### 1.2 Create Pass Type ID Certificate

1. In Pass Type ID details, click **Create Certificate**
2. Follow the Certificate Signing Request (CSR) process:
   - Open **Keychain Access** on Mac
   - **Certificate Assistant** → **Request a Certificate From a Certificate Authority**
   - Enter your email and name
   - Save CSR file
3. Upload CSR to Apple Developer Portal
4. Download the certificate
5. Double-click to install in Keychain
6. **Export the certificate and private key** as `.p12` file (password-protected)

### 1.3 Download WWDR Certificate

1. Download [Apple WWDR Certificate](https://www.apple.com/certificateauthority/)
2. Install in Keychain (double-click)

---

## Step 2: Server-Side Pass Generation

### 2.1 Create Edge Function for Pass Generation

**File:** `supabase/functions/generate-wallet-pass/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// You'll need a library like 'passkit-generator' or manual pass creation
// For Deno, you may need to use a different approach or port the library

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticket_id, user_id } = await req.json();
    
    // Verify user owns the ticket
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: ticket, error } = await supabase
      .from('tickets')
      .select(`
        *,
        ticket_tiers (
          name,
          event_id,
          events (
            title,
            start_at,
            venue_name,
            cover_image_url
          )
        )
      `)
      .eq('id', ticket_id)
      .eq('user_id', user_id)
      .single();

    if (error || !ticket) {
      return new Response(
        JSON.stringify({ error: 'Ticket not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate pass
    const pass = await generatePass({
      ticketId: ticket.id,
      qrCode: ticket.qr_code,
      eventTitle: ticket.ticket_tiers.events.title,
      eventDate: ticket.ticket_tiers.events.start_at,
      venue: ticket.ticket_tiers.events.venue_name,
      ticketTier: ticket.ticket_tiers.name,
      attendeeName: ticket.attendee_name || 'Guest',
      serialNumber: ticket.serial_no,
    });

    // Return .pkpass file
    return new Response(pass, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="ticket-${ticket.id}.pkpass"`,
      },
    });
  } catch (error) {
    console.error('Error generating pass:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate pass' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generatePass(data: {
  ticketId: string;
  qrCode: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  ticketTier: string;
  attendeeName: string;
  serialNumber: string;
}): Promise<Uint8Array> {
  // This is a simplified example - you'll need a proper pass generation library
  // For Deno, you might need to use a different approach or port a Node.js library
  
  // Pass structure (simplified):
  const pass = {
    formatVersion: 1,
    passTypeIdentifier: 'pass.com.liventix.app.eventtickets',
    serialNumber: data.serialNumber,
    teamIdentifier: 'YOUR_TEAM_ID', // From Apple Developer
    organizationName: 'Liventix',
    description: `${data.eventTitle} - ${data.ticketTier}`,
    logoText: 'Liventix',
    backgroundColor: 'rgb(3, 169, 244)', // Liventix blue
    foregroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(255, 255, 255)',
    eventTicket: {
      primaryFields: [
        {
          key: 'event',
          label: 'EVENT',
          value: data.eventTitle,
        },
      ],
      secondaryFields: [
        {
          key: 'date',
          label: 'DATE',
          value: new Date(data.eventDate).toLocaleDateString(),
        },
        {
          key: 'venue',
          label: 'VENUE',
          value: data.venue,
        },
      ],
      auxiliaryFields: [
        {
          key: 'tier',
          label: 'TIER',
          value: data.ticketTier,
        },
        {
          key: 'attendee',
          label: 'ATTENDEE',
          value: data.attendeeName,
        },
      ],
    },
    barcode: {
      message: data.qrCode,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
    },
    relevantDate: data.eventDate,
    expirationDate: new Date(new Date(data.eventDate).getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };

  // Sign and zip the pass (requires certificates)
  // This is complex - you'll need a library or manual implementation
  // See: https://github.com/alexandercerutti/passkit-generator (Node.js)
  // Or use a service like PassKit.com, WalletPasses.io, or build your own

  throw new Error('Pass generation not yet implemented - see implementation notes');
}
```

### 2.2 Alternative: Use a Pass Generation Service

**Recommended Services:**
1. **PassKit.com** - Enterprise solution
2. **WalletPasses.io** - API-based service
3. **Apple's Passbook Web Service** - Build your own

**Example with WalletPasses.io:**
```typescript
async function generatePassWithService(data: PassData): Promise<Uint8Array> {
  const response = await fetch('https://api.walletpasses.io/v1/passes', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WALLET_PASSES_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      passTypeIdentifier: 'pass.com.liventix.app.eventtickets',
      serialNumber: data.serialNumber,
      // ... pass data
    }),
  });
  
  return new Uint8Array(await response.arrayBuffer());
}
```

---

## Step 3: Frontend Integration

### 3.1 Install PassKit Plugin (if needed)

```bash
npm install @capacitor/passkit
npx cap sync ios
```

### 3.2 Create Wallet Button Component

**File:** `src/components/tickets/AddToWalletButton.tsx`

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet, Download, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface AddToWalletButtonProps {
  ticketId: string;
  className?: string;
}

export function AddToWalletButton({ ticketId, className }: AddToWalletButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Only show on iOS
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') {
    return null;
  }

  const handleAddToWallet = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to add tickets to Apple Wallet',
        variant: 'destructive',
      });
      return;
    }

    setIsAdding(true);

    try {
      // Check if PassKit is available
      const { PassKit } = await import('@capacitor/passkit');
      
      // Generate pass from server
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-wallet-pass`,
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
        throw new Error('Failed to generate pass');
      }

      // Get pass data as blob
      const passBlob = await response.blob();
      const passData = await passBlob.arrayBuffer();

      // Add to Wallet using PassKit
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
          <Wallet className="w-4 h-4 mr-2" />
          Add to Apple Wallet
        </>
      )}
    </Button>
  );
}
```

### 3.3 Alternative: Web-based PassKit (iOS Safari)

For web browsers on iOS, you can use the Web PassKit API:

```typescript
export function AddToWalletButtonWeb({ ticketId }: { ticketId: string }) {
  const handleAddToWallet = async () => {
    try {
      // Generate pass
      const response = await fetch('/api/generate-wallet-pass', {
        method: 'POST',
        body: JSON.stringify({ ticket_id: ticketId }),
      });

      const passBlob = await response.blob();
      const passUrl = URL.createObjectURL(passBlob);

      // Use Web PassKit API (iOS Safari only)
      if ('addPass' in window && typeof (window as any).addPass === 'function') {
        (window as any).addPass(passUrl);
      } else {
        // Fallback: download the pass file
        const a = document.createElement('a');
        a.href = passUrl;
        a.download = `ticket-${ticketId}.pkpass`;
        a.click();
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <button onClick={handleAddToWallet}>
      Add to Apple Wallet
    </button>
  );
}
```

### 3.4 Integrate into Ticket Detail Component

**File:** `src/components/tickets/TicketDetail.tsx`

```typescript
import { AddToWalletButton } from './AddToWalletButton';

// In your component:
<AddToWalletButton ticketId={ticket.id} className="mt-4" />
```

---

## Step 4: Pass Updates (Optional but Recommended)

Apple Wallet can update passes automatically. You need to implement a web service endpoint.

### 4.1 Create Pass Updates Endpoint

**File:** `supabase/functions/wallet-pass-updates/index.ts`

```typescript
// This endpoint is called by Apple to check for pass updates
serve(async (req) => {
  const url = new URL(req.url);
  const serialNumber = url.searchParams.get('serialNumber');
  const passTypeIdentifier = url.searchParams.get('passTypeIdentifier');
  const lastUpdated = url.searchParams.get('lastUpdated');

  // Check if pass needs update
  const { data: ticket } = await supabase
    .from('tickets')
    .select('updated_at, status')
    .eq('serial_no', serialNumber)
    .single();

  if (!ticket || new Date(ticket.updated_at) <= new Date(lastUpdated || 0)) {
    // No updates needed
    return new Response('', { status: 304 }); // Not Modified
  }

  // Generate updated pass
  const updatedPass = await generatePass({ /* ... */ });
  
  return new Response(updatedPass, {
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
      'Last-Modified': ticket.updated_at,
    },
  });
});
```

### 4.2 Register Update URL in Pass

When generating the pass, include:

```json
{
  "webServiceURL": "https://liventix.tech/api/wallet-pass-updates",
  "authenticationToken": "YOUR_AUTH_TOKEN"
}
```

---

## Step 5: Database Schema Updates

### 5.1 Add Wallet Pass Tracking (Optional)

```sql
-- Track which tickets have been added to wallet
ALTER TABLE ticketing.tickets
ADD COLUMN IF NOT EXISTS wallet_pass_serial_number TEXT,
ADD COLUMN IF NOT EXISTS wallet_pass_added_at TIMESTAMPTZ;

-- Index for pass updates
CREATE INDEX IF NOT EXISTS idx_tickets_wallet_serial 
ON ticketing.tickets(wallet_pass_serial_number) 
WHERE wallet_pass_serial_number IS NOT NULL;
```

---

## Step 6: Testing

### 6.1 Test Checklist

- [ ] Pass Type ID created in Apple Developer Portal
- [ ] Certificate installed and exported
- [ ] Pass generation endpoint working
- [ ] Pass file downloads correctly
- [ ] Pass opens in Wallet app
- [ ] QR code scans correctly
- [ ] Pass updates work (if implemented)
- [ ] Works on iOS device (not just simulator)

### 6.2 Testing on Device

1. **Development:** Use development certificates
2. **Distribution:** Use production certificates
3. **TestFlight:** Can test with TestFlight builds
4. **Production:** Requires App Store approval

---

## Step 7: Implementation Options Summary

### Option 1: Build Your Own (Complex)
- ✅ Full control
- ✅ No third-party costs
- ❌ Complex certificate management
- ❌ Requires pass signing implementation
- ❌ Time-intensive

### Option 2: Use PassKit Service (Recommended)
- ✅ Faster implementation
- ✅ Handles certificates
- ✅ Pass updates included
- ❌ Monthly cost (~$50-200/month)
- ❌ Less control

**Recommended Services:**
- **PassKit.com** - Enterprise, full-featured
- **WalletPasses.io** - Developer-friendly API
- **PassNinja** - Simple, affordable

### Option 3: Hybrid Approach
- Generate passes yourself
- Use service for updates only

---

## Quick Start (Using WalletPasses.io)

1. **Sign up** at [WalletPasses.io](https://walletpasses.io)
2. **Get API key** and Pass Type ID
3. **Create Edge Function:**

```typescript
// supabase/functions/generate-wallet-pass/index.ts
serve(async (req) => {
  const { ticket_id } = await req.json();
  
  // Fetch ticket data
  const ticket = await getTicket(ticket_id);
  
  // Generate pass via WalletPasses.io API
  const response = await fetch('https://api.walletpasses.io/v1/passes', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('WALLET_PASSES_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      passTypeIdentifier: 'pass.com.liventix.app.eventtickets',
      serialNumber: ticket.serial_no,
      eventTicket: {
        primaryFields: [{ key: 'event', value: ticket.event_title }],
        // ... more fields
      },
      barcode: {
        message: ticket.qr_code,
        format: 'PKBarcodeFormatQR',
      },
    }),
  });
  
  const passData = await response.arrayBuffer();
  return new Response(passData, {
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
    },
  });
});
```

4. **Add button to ticket page** (see Step 3.2)

---

## Cost Estimate

- **Apple Developer Program:** $99/year (required)
- **PassKit Service:** $0-200/month (optional, if using service)
- **Development Time:** 2-4 weeks (if building yourself)

---

## Next Steps

1. ✅ Choose implementation approach (service vs. custom)
2. ✅ Set up Apple Developer Pass Type ID
3. ✅ Create pass generation endpoint
4. ✅ Add frontend button component
5. ✅ Test on iOS device
6. ✅ Deploy to production

---

## Resources

- [Apple PassKit Documentation](https://developer.apple.com/documentation/passkit)
- [PassKit Generator (Node.js)](https://github.com/alexandercerutti/passkit-generator)
- [WalletPasses.io API Docs](https://walletpasses.io/docs)
- [PassKit.com Documentation](https://docs.passkit.com)

---

## Notes

- **Android:** Google Wallet has similar functionality but different implementation
- **Web:** PassKit Web API only works in iOS Safari
- **Updates:** Pass updates require HTTPS endpoint with valid SSL certificate
- **Certificates:** Keep certificates secure - never commit to git

