# 🎫 Google Wallet Integration Guide for Event Tickets

## Overview

Google Wallet (formerly Google Pay) is Google's digital wallet platform that supports passes, tickets, loyalty cards, and more. Unlike Apple Wallet, Google Wallet works on **both Android and iOS** (via web), and the implementation is generally simpler.

---

## Prerequisites

### 1. Google Cloud Account Requirements

- ✅ **Google Cloud Platform (GCP) Account** (free tier available)
- ✅ **Google Pay Passes API** enabled
- ✅ **Service Account** with Passes API access
- ✅ **Service Account Key** (JSON file)

### 2. Technical Requirements

- ✅ Server-side pass generation (Edge Function or API endpoint)
- ✅ JWT-based authentication
- ✅ Google Pay Passes API access
- ✅ Frontend integration (web-based, works on all platforms)

---

## Step 1: Google Cloud Setup

### 1.1 Enable Google Pay Passes API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing: **"Liventix"**
3. Navigate to **APIs & Services** → **Library**
4. Search for **"Google Pay Passes API"**
5. Click **Enable**

### 1.2 Create Service Account

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. **Name:** `liventix-wallet-service`
4. **Description:** `Service account for Google Wallet pass generation`
5. Click **Create and Continue**
6. **Grant access:** Skip (we'll add permissions via API)
7. Click **Done**

### 1.3 Create Service Account Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Choose **JSON** format
5. Download the key file
6. **⚠️ SECURITY:** Store this file securely, never commit to git
7. **Add to Supabase Secrets:**
   ```bash
   supabase secrets set GOOGLE_WALLET_SERVICE_ACCOUNT_KEY='<paste JSON content>'
   ```

### 1.4 Get Issuer ID

1. Go to [Google Pay & Wallet Console](https://pay.google.com/business/console)
2. Sign in with your Google account
3. Click **Get started** or **Create pass**
4. Your **Issuer ID** will be displayed (format: `1234567890123456789`)
5. **Save this ID** - you'll need it for pass generation

---

## Step 2: Server-Side Pass Generation

### 2.1 Create Edge Function for Google Wallet Pass

**File:** `supabase/functions/generate-google-wallet-pass/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Google Pay Passes API endpoint
const GOOGLE_WALLET_API = 'https://walletobjects.googleapis.com/walletobjects/v1';

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

    // Generate Google Wallet pass
    const passUrl = await generateGoogleWalletPass({
      ticketId: ticket.id,
      qrCode: ticket.qr_code,
      serialNumber: ticket.serial_no,
      eventTitle: ticket.ticket_tiers.events.title,
      eventDate: ticket.ticket_tiers.events.start_at,
      venue: ticket.ticket_tiers.events.venue_name,
      ticketTier: ticket.ticket_tiers.name,
      attendeeName: ticket.attendee_name || 'Guest',
      coverImage: ticket.ticket_tiers.events.cover_image_url,
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        passUrl,
        addToWalletUrl: `https://pay.google.com/gp/v/save/${passUrl}`,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error generating Google Wallet pass:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate pass' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateGoogleWalletPass(data: {
  ticketId: string;
  qrCode: string;
  serialNumber: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  ticketTier: string;
  attendeeName: string;
  coverImage?: string;
}): Promise<string> {
  // Load service account key from environment
  const serviceAccountKey = JSON.parse(
    Deno.env.get('GOOGLE_WALLET_SERVICE_ACCOUNT_KEY') ?? '{}'
  );
  
  const ISSUER_ID = Deno.env.get('GOOGLE_WALLET_ISSUER_ID') ?? '';
  const CLASS_ID = `${ISSUER_ID}.event_ticket_class`;
  const OBJECT_ID = `${ISSUER_ID}.${data.serialNumber}`;

  // Generate JWT for authentication
  const jwt = await generateJWT(serviceAccountKey, ISSUER_ID);

  // Create or update pass class (one-time setup per event type)
  await createOrUpdatePassClass(jwt, CLASS_ID, {
    id: CLASS_ID,
    issuerName: 'Liventix',
    reviewStatus: 'UNDER_REVIEW', // Change to 'APPROVED' after review
    eventName: {
      defaultValue: {
        language: 'en-US',
        value: 'Event Ticket',
      },
    },
  });

  // Create pass object
  const passObject = {
    id: OBJECT_ID,
    classId: CLASS_ID,
    state: 'ACTIVE',
    barcode: {
      type: 'QR_CODE',
      value: data.qrCode,
      alternateText: data.serialNumber,
    },
    eventTicketObject: {
      ticketHolderName: data.attendeeName,
      ticketNumber: data.serialNumber,
      seatInfo: {
        seat: {
          seatSection: data.ticketTier,
        },
      },
    },
    textModulesData: [
      {
        header: 'EVENT',
        body: data.eventTitle,
        id: 'event',
      },
      {
        header: 'DATE',
        body: new Date(data.eventDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        id: 'date',
      },
      {
        header: 'VENUE',
        body: data.venue,
        id: 'venue',
      },
    ],
    linksModuleData: {
      uris: [
        {
          uri: `https://liventix.tech/e/${data.ticketId}`,
          description: 'View event details',
          id: 'event_link',
        },
      ],
    },
    imageModulesData: data.coverImage ? [
      {
        mainImage: {
          sourceUri: {
            uri: data.coverImage,
          },
          contentDescription: {
            defaultValue: {
              language: 'en-US',
              value: 'Event cover image',
            },
          },
        },
        id: 'cover_image',
      },
    ] : [],
    validTimeInterval: {
      start: {
        date: new Date(data.eventDate).toISOString(),
      },
      end: {
        date: new Date(new Date(data.eventDate).getTime() + 24 * 60 * 60 * 1000).toISOString(),
      },
    },
  };

  // Create the pass object via API
  const response = await fetch(
    `${GOOGLE_WALLET_API}/eventTicketObject?strict=true`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(passObject),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create pass: ${error}`);
  }

  const result = await response.json();
  return result.id; // Return object ID for save URL
}

async function createOrUpdatePassClass(jwt: string, classId: string, classData: any) {
  try {
    // Try to get existing class
    await fetch(
      `${GOOGLE_WALLET_API}/eventTicketClass/${classId}`,
      {
        headers: {
          'Authorization': `Bearer ${jwt}`,
        },
      }
    );
    // Class exists, skip creation
  } catch {
    // Class doesn't exist, create it
    await fetch(
      `${GOOGLE_WALLET_API}/eventTicketClass?strict=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(classData),
      }
    );
  }
}

async function generateJWT(serviceAccount: any, issuerId: string): Promise<string> {
  // JWT generation for Google API authentication
  // This is a simplified version - you may need a JWT library
  
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600, // 1 hour
    scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
  };

  // Sign JWT with private key (requires crypto library)
  // For Deno, you can use: https://deno.land/x/djwt@v2.8/mod.ts
  const { create } = await import('https://deno.land/x/djwt@v2.8/mod.ts');
  
  return await create(
    { alg: 'RS256', typ: 'JWT' },
    payload,
    serviceAccount.private_key
  );
}
```

### 2.2 Install JWT Library for Deno

**File:** `supabase/functions/generate-google-wallet-pass/deno.json`

```json
{
  "imports": {
    "djwt": "https://deno.land/x/djwt@v2.8/mod.ts"
  }
}
```

---

## Step 3: Frontend Integration

### 3.1 Create Google Wallet Button Component

**File:** `src/components/tickets/AddToGoogleWalletButton.tsx`

```typescript
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Wallet, Download, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface AddToGoogleWalletButtonProps {
  ticketId: string;
  className?: string;
}

export function AddToGoogleWalletButton({ 
  ticketId, 
  className 
}: AddToGoogleWalletButtonProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleAddToWallet = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to add tickets to Google Wallet',
        variant: 'destructive',
      });
      return;
    }

    setIsAdding(true);

    try {
      // Generate pass from server
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-google-wallet-pass`,
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

      const { passUrl, addToWalletUrl } = await response.json();

      // Open Google Wallet save URL
      // This works on both Android and iOS (via web)
      window.open(addToWalletUrl, '_blank');

      setIsAdded(true);
      toast({
        title: 'Opening Google Wallet',
        description: 'Add your ticket to Google Wallet',
      });
    } catch (error: any) {
      console.error('Error adding to Google Wallet:', error);
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
          Add to Google Wallet
        </>
      )}
    </Button>
  );
}
```

### 3.2 Alternative: Direct Google Wallet Button (Web)

Google provides a pre-built button component:

```typescript
import { useEffect } from 'react';

export function GoogleWalletButton({ passUrl }: { passUrl: string }) {
  useEffect(() => {
    // Load Google Pay button script
    const script = document.createElement('script');
    script.src = 'https://pay.google.com/gp/p/js/pay.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div
      id="google-wallet-button"
      data-pass-url={passUrl}
      style={{
        width: '100%',
        height: '48px',
      }}
    />
  );
}
```

---

## Step 4: Combined Wallet Button Component

**File:** `src/components/tickets/AddToWalletButton.tsx`

```typescript
import { AddToAppleWalletButton } from './AddToAppleWalletButton';
import { AddToGoogleWalletButton } from './AddToGoogleWalletButton';
import { Capacitor } from '@capacitor/core';

interface AddToWalletButtonProps {
  ticketId: string;
  className?: string;
}

export function AddToWalletButton({ ticketId, className }: AddToWalletButtonProps) {
  const platform = Capacitor.getPlatform();
  const isIOS = platform === 'ios';
  const isAndroid = platform === 'android';

  return (
    <div className="flex flex-col gap-2">
      {/* Show both on web, platform-specific on native */}
      {(!isIOS || isAndroid) && (
        <AddToGoogleWalletButton ticketId={ticketId} className={className} />
      )}
      {isIOS && (
        <AddToAppleWalletButton ticketId={ticketId} className={className} />
      )}
    </div>
  );
}
```

---

## Step 5: Pass Updates (Optional)

Google Wallet supports automatic pass updates via push notifications.

### 5.1 Create Pass Update Endpoint

```typescript
// supabase/functions/update-google-wallet-pass/index.ts
serve(async (req) => {
  const { ticket_id, updates } = await req.json();
  
  // Update pass object via Google Wallet API
  const jwt = await generateJWT(serviceAccount, ISSUER_ID);
  const objectId = `${ISSUER_ID}.${ticket.serial_no}`;
  
  await fetch(
    `${GOOGLE_WALLET_API}/eventTicketObject/${objectId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    }
  );
  
  // Send push notification to update pass
  await fetch(
    `${GOOGLE_WALLET_API}/eventTicketObject/${objectId}:addMessage`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          action: 'UPDATE',
          messageHeader: {
            messageClass: 'TICKET_UPDATE',
            localizedMessageHeader: {
              defaultValue: {
                language: 'en-US',
                value: 'Ticket Updated',
              },
            },
          },
        },
      }),
    }
  );
});
```

---

## Step 6: Database Schema Updates

```sql
-- Track Google Wallet passes
ALTER TABLE ticketing.tickets
ADD COLUMN IF NOT EXISTS google_wallet_object_id TEXT,
ADD COLUMN IF NOT EXISTS google_wallet_added_at TIMESTAMPTZ;

-- Index for pass updates
CREATE INDEX IF NOT EXISTS idx_tickets_google_wallet_object 
ON ticketing.tickets(google_wallet_object_id) 
WHERE google_wallet_object_id IS NOT NULL;
```

---

## Comparison: Apple Wallet vs Google Wallet

| Feature | Apple Wallet | Google Wallet |
|---------|-------------|---------------|
| **Platforms** | iOS only | Android + iOS (web) |
| **Setup Complexity** | High (certificates) | Medium (service account) |
| **Cost** | $99/year (Apple Dev) | Free (GCP free tier) |
| **Pass Format** | .pkpass (binary) | JSON (API-based) |
| **Updates** | Web service endpoint | Push notifications |
| **Web Support** | iOS Safari only | All browsers |
| **Implementation Time** | 2-4 weeks | 1-2 weeks |

---

## Advantages of Google Wallet

✅ **Cross-platform:** Works on Android, iOS, and web  
✅ **Simpler setup:** No certificate management  
✅ **Free:** No additional costs beyond GCP free tier  
✅ **Better web support:** Works in all browsers  
✅ **Easier updates:** Push notification system  
✅ **Faster implementation:** Less complex than Apple Wallet  

---

## Quick Start Checklist

- [ ] Create Google Cloud project
- [ ] Enable Google Pay Passes API
- [ ] Create service account
- [ ] Download service account key
- [ ] Get Issuer ID from Google Pay Console
- [ ] Add secrets to Supabase
- [ ] Create Edge Function for pass generation
- [ ] Create frontend button component
- [ ] Test on Android device
- [ ] Test on iOS (via web)
- [ ] Deploy to production

---

## Cost Estimate

- **Google Cloud:** Free tier (sufficient for most use cases)
- **Google Pay Passes API:** Free (no per-pass charges)
- **Development Time:** 1-2 weeks

**Total Cost:** $0/month (vs Apple Wallet's $99/year + potential service costs)

---

## Resources

- [Google Pay Passes API Documentation](https://developers.google.com/wallet/generic)
- [Google Pay & Wallet Console](https://pay.google.com/business/console)
- [Google Cloud Console](https://console.cloud.google.com/)
- [JWT Library for Deno](https://deno.land/x/djwt)

---

## Next Steps

1. ✅ Set up Google Cloud project
2. ✅ Enable Passes API
3. ✅ Create service account
4. ✅ Create Edge Function
5. ✅ Add frontend button
6. ✅ Test on devices
7. ✅ Deploy

**Recommendation:** Start with Google Wallet (simpler, cross-platform), then add Apple Wallet for iOS users who prefer native integration.

