# 🔄 Refund System Analysis & Implementation Guide

**Date:** November 11, 2025  
**Status:** Wallet refunds automated ✅ | Ticket refunds manual ❌

---

## 📊 **Current State: What Already Exists**

### ✅ **Wallet/Credit Refund System - FULLY AUTOMATED**

Liventix already has a **complete automated refund system** for wallet-based purchases (sponsorships, ads, credits).

---

### **1. Database Functions (Already Exist)**

#### **User Wallet Refunds:**
```sql
-- Location: complete_database.sql, line 6358
CREATE OR REPLACE FUNCTION public.wallet_apply_refund(
  p_invoice_id UUID,
  p_wallet_id UUID,
  p_refund_usd_cents INTEGER,
  p_idempotency_key TEXT
)
RETURNS TABLE(new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
```

**What it does:**
- ✅ Idempotent (prevents duplicate refunds)
- ✅ Locks wallet for atomic update
- ✅ Creates refund transaction record
- ✅ Updates wallet balance (returns credits)
- ✅ Returns new balance

---

#### **Organization Wallet Refunds:**
```sql
-- Location: supabase/migrations/20250126040000_create_org_wallet_rpc_functions.sql, line 73
CREATE OR REPLACE FUNCTION organizations.org_wallet_apply_refund(
  p_wallet_id UUID,
  p_refund_credits INTEGER,
  p_invoice_id UUID,
  p_stripe_event_id TEXT,
  p_description TEXT DEFAULT 'Refund'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
```

**What it does:**
- ✅ Refunds credits to org wallet
- ✅ Creates transaction record
- ✅ Marks invoice as refunded
- ✅ Idempotent via stripe_event_id
- ✅ Freezes wallet if negative

---

### **2. Webhook Handler (Already Exists)**

**File:** `supabase/functions/wallet-stripe-webhook/index.ts`

```typescript
// Line 222-268
case "charge.refunded": {
  const charge = event.data.object as Stripe.Charge;
  const piId = (charge.payment_intent as string) ?? null;
  
  // Find invoice by payment intent
  const { data: inv } = await sb
    .from("invoices")
    .select("id, wallet_id, org_wallet_id")
    .eq("stripe_payment_intent_id", piId)
    .maybeSingle();

  const refundCents = charge.amount_refunded ?? 0;
  const isOrgWallet = !!inv.org_wallet_id;

  if (isOrgWallet) {
    // ✅ Automatically refunds org wallet credits
    await sb.rpc("org_wallet_apply_refund", {
      p_wallet_id: inv.org_wallet_id,
      p_refund_credits: refundCents,
      p_invoice_id: inv.id,
      p_stripe_event_id: event.id,
      p_description: "Refund"
    });
  } else {
    // ✅ Automatically refunds user wallet credits
    await sb.rpc("wallet_apply_refund", {
      p_invoice_id: inv.id,
      p_wallet_id: inv.wallet_id,
      p_refund_usd_cents: refundCents,
      p_idempotency_key: event.id
    });
  }
}
```

**What it does:**
- ✅ Listens for Stripe `charge.refunded` webhook
- ✅ Finds the invoice automatically
- ✅ Determines wallet type (user vs org)
- ✅ Calls appropriate refund function
- ✅ Logs success
- ✅ Idempotent (won't process twice)

---

### **3. Supporting Infrastructure (Already Exists)**

#### **Tables:**
- ✅ `wallets` - User credit wallets
- ✅ `wallet_transactions` - Transaction log with refunds
- ✅ `organizations.org_wallets` - Org credit wallets
- ✅ `organizations.org_wallet_transactions` - Org transaction log
- ✅ `organizations.invoices` - Payment records with refund status

#### **Columns:**
- ✅ `invoices.status` - Can be 'refunded'
- ✅ `org_wallets.status` - Can be 'frozen'
- ✅ `wallet_transactions.type` - Supports 'refund'

#### **Webhook Configuration:**
- ✅ Stripe webhook endpoint: `wallet-stripe-webhook`
- ✅ Event subscribed: `charge.refunded`
- ✅ Signature verification working

---

## ❌ **Ticket Refund System - NOT AUTOMATED**

### **What Currently Doesn't Exist for Tickets:**

#### **1. No Database Function**
```
❌ Missing: ticketing.process_ticket_refund()
```

**Needed capabilities:**
- Mark tickets as 'refunded'
- Update order status to 'refunded'
- Release inventory (decrement issued_quantity)
- Log refund for audit trail
- Prevent duplicate refunds (idempotency)

---

#### **2. No Ticket Status Support**
```
Current ticket statuses: 'issued', 'transferred', 'redeemed'
Missing: 'refunded', 'cancelled'
```

**Schema changes needed:**
```sql
-- May need to add refunded_at column
ALTER TABLE ticketing.tickets 
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- May need to add refund tracking
ALTER TABLE ticketing.orders
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
```

---

#### **3. No Webhook Handler**
```
❌ stripe-webhook doesn't handle ticket refunds
```

**Current webhook (`stripe-webhook/index.ts`):**
- ✅ Handles `checkout.session.completed` (payment success)
- ✅ Handles `payment_intent.succeeded` (payment confirmed)
- ❌ Does NOT handle `charge.refunded` for tickets

**Missing logic:**
```typescript
case "charge.refunded": {
  // Find order by payment_intent_id
  // Call process_ticket_refund()
  // Send confirmation email
}
```

---

#### **4. No Refund Log Table**
```
❌ Missing: ticketing.refund_log
```

**Needed for:**
- Audit trail of all refunds
- Idempotency via stripe_event_id
- Reporting and analytics
- Customer support reference

---

#### **5. No Edge Function for Manual Refunds**
```
❌ Missing: process-refund Edge Function
```

**Needed for:**
- Organizers to initiate refunds from admin panel
- Customer self-service refund requests
- Manual refund processing with automation

---

#### **6. No Refund Confirmation Email**
```
❌ Missing: send-refund-confirmation Edge Function
```

**Needed for:**
- Notify customer of successful refund
- Provide refund details (amount, timing)
- Professional customer experience

---

#### **7. No Frontend UI**
```
❌ Missing: "Request Refund" button in tickets page
❌ Missing: Refund status display in order history
❌ Missing: Organizer refund approval panel
```

---

## 📋 **Implementation Plan: Automated Ticket Refunds**

### **Phase 1: Database Layer** ⏱️ 15 minutes

#### **Step 1.1: Add Refund Log Table**
```sql
-- Create audit trail for ticket refunds
CREATE TABLE IF NOT EXISTS ticketing.refund_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES ticketing.orders(id) ON DELETE CASCADE,
  refund_amount_cents INTEGER NOT NULL,
  stripe_refund_id TEXT,
  stripe_event_id TEXT UNIQUE,  -- For idempotency
  reason TEXT,
  refund_type TEXT,  -- 'full', 'partial', 'admin', 'customer'
  tickets_refunded INTEGER,
  initiated_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB
);

CREATE INDEX idx_refund_log_order ON ticketing.refund_log(order_id);
CREATE INDEX idx_refund_log_stripe_event ON ticketing.refund_log(stripe_event_id);
CREATE INDEX idx_refund_log_processed ON ticketing.refund_log(processed_at DESC);

COMMENT ON TABLE ticketing.refund_log IS 
  'Audit trail for all ticket refunds with idempotency via stripe_event_id';

GRANT SELECT ON ticketing.refund_log TO authenticated, service_role;
GRANT INSERT ON ticketing.refund_log TO service_role;
```

#### **Step 1.2: Add Refund Columns to Tickets/Orders**
```sql
-- Add refunded_at timestamp to tickets
ALTER TABLE ticketing.tickets 
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Add refunded_at timestamp to orders
ALTER TABLE ticketing.orders
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Add index for refund queries
CREATE INDEX IF NOT EXISTS idx_tickets_refunded 
ON ticketing.tickets(refunded_at) 
WHERE refunded_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_refunded 
ON ticketing.orders(refunded_at) 
WHERE refunded_at IS NOT NULL;
```

#### **Step 1.3: Create Refund Processing Function**
```sql
-- Atomic ticket refund processor
CREATE OR REPLACE FUNCTION ticketing.process_ticket_refund(
  p_order_id UUID,
  p_refund_amount_cents INTEGER,
  p_stripe_refund_id TEXT DEFAULT NULL,
  p_stripe_event_id TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT 'Customer request',
  p_refund_type TEXT DEFAULT 'full',
  p_initiated_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ticketing, public
AS $$
DECLARE
  v_ticket_count INTEGER := 0;
  v_order_record RECORD;
  v_tier_updates JSONB := '[]'::jsonb;
BEGIN
  -- ============================================================================
  -- 1. IDEMPOTENCY CHECK
  -- ============================================================================
  IF p_stripe_event_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM ticketing.refund_log 
    WHERE stripe_event_id = p_stripe_event_id
  ) THEN
    RETURN jsonb_build_object(
      'status', 'already_processed',
      'message', 'Refund already applied via webhook',
      'stripe_event_id', p_stripe_event_id
    );
  END IF;

  -- ============================================================================
  -- 2. VALIDATE ORDER EXISTS AND IS REFUNDABLE
  -- ============================================================================
  SELECT * INTO v_order_record
  FROM ticketing.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Order not found',
      'order_id', p_order_id
    );
  END IF;

  IF v_order_record.status = 'refunded' THEN
    RETURN jsonb_build_object(
      'status', 'already_refunded',
      'message', 'Order already refunded',
      'refunded_at', v_order_record.refunded_at
    );
  END IF;

  IF v_order_record.status != 'paid' THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', 'Can only refund paid orders',
      'current_status', v_order_record.status
    );
  END IF;

  -- ============================================================================
  -- 3. MARK TICKETS AS REFUNDED
  -- ============================================================================
  UPDATE ticketing.tickets
  SET 
    status = 'refunded',
    refunded_at = now()
  WHERE order_id = p_order_id
    AND status IN ('issued', 'transferred')  -- Don't refund already redeemed tickets
    AND refunded_at IS NULL;  -- Prevent double refund

  GET DIAGNOSTICS v_ticket_count = ROW_COUNT;

  IF v_ticket_count = 0 THEN
    RETURN jsonb_build_object(
      'status', 'warning',
      'message', 'No refundable tickets found (already redeemed or refunded)',
      'order_id', p_order_id
    );
  END IF;

  -- ============================================================================
  -- 4. RELEASE INVENTORY (Decrement issued_quantity)
  -- ============================================================================
  WITH refunded_counts AS (
    SELECT 
      tier_id,
      COUNT(*) as refund_count
    FROM ticketing.tickets
    WHERE order_id = p_order_id
      AND status = 'refunded'
      AND refunded_at = (SELECT MAX(refunded_at) FROM ticketing.tickets WHERE order_id = p_order_id)
    GROUP BY tier_id
  )
  UPDATE ticketing.ticket_tiers tt
  SET 
    issued_quantity = GREATEST(0, issued_quantity - rc.refund_count),
    updated_at = now()
  FROM refunded_counts rc
  WHERE tt.id = rc.tier_id
  RETURNING jsonb_build_object(
    'tier_id', tt.id,
    'tier_name', tt.name,
    'released', rc.refund_count
  ) INTO v_tier_updates;

  -- ============================================================================
  -- 5. UPDATE ORDER STATUS
  -- ============================================================================
  UPDATE ticketing.orders
  SET 
    status = 'refunded',
    refunded_at = now()
  WHERE id = p_order_id;

  -- ============================================================================
  -- 6. LOG REFUND FOR AUDIT TRAIL
  -- ============================================================================
  INSERT INTO ticketing.refund_log (
    order_id,
    refund_amount_cents,
    stripe_refund_id,
    stripe_event_id,
    reason,
    refund_type,
    tickets_refunded,
    initiated_by,
    metadata
  ) VALUES (
    p_order_id,
    p_refund_amount_cents,
    p_stripe_refund_id,
    p_stripe_event_id,
    p_reason,
    p_refund_type,
    v_ticket_count,
    p_initiated_by,
    jsonb_build_object(
      'tier_updates', v_tier_updates,
      'processed_at', now()
    )
  );

  -- ============================================================================
  -- 7. RETURN SUCCESS RESULT
  -- ============================================================================
  RETURN jsonb_build_object(
    'status', 'success',
    'tickets_refunded', v_ticket_count,
    'amount_refunded_cents', p_refund_amount_cents,
    'inventory_released', v_tier_updates,
    'order_id', p_order_id,
    'processed_at', now()
  );
END;
$$;

COMMENT ON FUNCTION ticketing.process_ticket_refund IS 
  'Atomically processes ticket refunds: marks tickets as refunded, releases inventory, logs audit trail. Idempotent via stripe_event_id.';

GRANT EXECUTE ON FUNCTION ticketing.process_ticket_refund TO service_role;
```

**Status:** ❌ Does NOT exist yet

---

### **2. Webhook Handler for Tickets (Needs Addition)**

**File:** `supabase/functions/stripe-webhook/index.ts`

**Current state:**
- ✅ Handles `checkout.session.completed` (new purchases)
- ✅ Handles `payment_intent.succeeded` (payment confirmed)
- ❌ Does NOT handle `charge.refunded` for tickets

**Needed addition:**
```typescript
// Add this case to stripe-webhook/index.ts after line 65
case "charge.refunded": {
  logStep("Refund event received", { eventId: event.id });
  
  const charge = event.data.object as Stripe.Charge;
  const piId = (charge.payment_intent as string) ?? null;
  
  if (!piId) {
    logStep("No payment intent ID in refund event");
    break;
  }

  // Find order by payment intent
  const { data: order, error: orderErr } = await supabaseService
    .from("orders")
    .select("id, user_id, event_id, total_cents, contact_email")
    .eq("stripe_payment_intent_id", piId)
    .maybeSingle();

  if (orderErr || !order) {
    logStep("No order found for refund", { paymentIntentId: piId });
    break;
  }

  const refundCents = charge.amount_refunded ?? 0;
  logStep("Processing ticket refund", { 
    orderId: order.id, 
    refundCents,
    stripeEventId: event.id 
  });

  // Process refund automatically
  const { data: refundResult, error: refundErr } = await supabaseService
    .rpc('process_ticket_refund', {
      p_order_id: order.id,
      p_refund_amount_cents: refundCents,
      p_stripe_refund_id: charge.refund as string,
      p_stripe_event_id: event.id,
      p_reason: 'Stripe admin refund',
      p_refund_type: 'admin'
    });

  if (refundErr) {
    logStep("❌ Refund processing failed", { error: refundErr.message });
    throw refundErr;
  }

  logStep("✅ Refund processed successfully", { 
    orderId: order.id,
    ticketsRefunded: refundResult?.tickets_refunded,
    inventoryReleased: refundResult?.inventory_released
  });

  // Send refund confirmation email
  try {
    await supabaseService.functions.invoke('send-refund-confirmation', {
      body: {
        order_id: order.id,
        email: order.contact_email,
        refund_amount: refundCents / 100,
        tickets_refunded: refundResult?.tickets_refunded
      }
    });
    logStep("✅ Refund confirmation email sent");
  } catch (emailErr) {
    logStep("⚠️ Refund email failed (non-critical)", { error: emailErr });
  }

  break;
}
```

**Status:** ❌ Needs to be added

---

### **3. Manual Refund Edge Function (Needs Creation)**

**File:** `supabase/functions/process-refund/index.ts` (NEW)

**Purpose:** Allow organizers or support to initiate refunds programmatically

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, reason, amount_cents } = await req.json();
    
    if (!order_id) {
      throw new Error("order_id is required");
    }

    console.log(`[process-refund] Starting refund for order: ${order_id}`);

    // Create Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get order details
    const { data: order, error: orderErr } = await supabaseService
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      throw new Error(`Order not found: ${order_id}`);
    }

    if (order.status === 'refunded') {
      return new Response(
        JSON.stringify({ 
          status: 'already_refunded',
          refunded_at: order.refunded_at
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    if (order.status !== 'paid') {
      throw new Error(`Order must be paid to refund. Current status: ${order.status}`);
    }

    if (!order.stripe_payment_intent_id) {
      throw new Error("No Stripe payment intent found for this order");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20"
    });

    // Determine refund amount (full or partial)
    const refundAmountCents = amount_cents || order.total_cents;
    const isFullRefund = refundAmountCents >= order.total_cents;

    console.log(`[process-refund] Creating Stripe refund: $${refundAmountCents / 100}`);

    // Process Stripe refund
    const refund = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      amount: refundAmountCents,
      reason: 'requested_by_customer',
      metadata: {
        order_id: order.id,
        refund_reason: reason || 'Customer request',
        refund_type: isFullRefund ? 'full' : 'partial'
      }
    });

    console.log(`[process-refund] Stripe refund created: ${refund.id}`);

    // Process database updates (the webhook will also do this, but we do it
    // synchronously for faster UX - idempotency prevents duplicates)
    const { data: dbResult, error: dbErr } = await supabaseService
      .rpc('process_ticket_refund', {
        p_order_id: order.id,
        p_refund_amount_cents: refundAmountCents,
        p_stripe_refund_id: refund.id,
        p_stripe_event_id: null,  // Will be set by webhook later
        p_reason: reason || 'Customer request',
        p_refund_type: isFullRefund ? 'full' : 'partial',
        p_initiated_by: null  // Could get from JWT if needed
      });

    if (dbErr) {
      console.error("[process-refund] Database update failed:", dbErr);
      // Stripe refund succeeded, but DB update failed
      // Webhook will retry this later
      return new Response(
        JSON.stringify({
          status: 'stripe_refunded_db_pending',
          refund_id: refund.id,
          warning: 'Stripe refund succeeded, database update pending (webhook will complete)'
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`[process-refund] Database updated: ${dbResult?.tickets_refunded} tickets refunded`);

    // Send refund confirmation email
    try {
      await supabaseService.functions.invoke('send-refund-confirmation', {
        body: {
          order_id: order.id,
          email: order.contact_email,
          refund_amount: refundAmountCents / 100,
          tickets_refunded: dbResult?.tickets_refunded,
          reason: reason
        }
      });
      console.log("[process-refund] ✅ Refund confirmation email sent");
    } catch (emailErr) {
      console.warn("[process-refund] Email send failed (non-critical):", emailErr);
    }

    return new Response(
      JSON.stringify({
        status: 'success',
        refund: {
          id: refund.id,
          amount: refundAmountCents / 100,
          status: refund.status
        },
        database: {
          tickets_refunded: dbResult?.tickets_refunded,
          inventory_released: dbResult?.inventory_released
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("[process-refund] ERROR:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Refund processing failed" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
```

**Status:** ❌ Needs to be created

---

### **Phase 2: Email Notification** ⏱️ 10 minutes

#### **Step 2.1: Create Refund Confirmation Email**

**File:** `supabase/functions/send-refund-confirmation/index.ts` (NEW)

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  try {
    const { order_id, email, refund_amount, tickets_refunded, reason } = await req.json();

    if (!email || !order_id) {
      throw new Error("Email and order_id required");
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.warn("[send-refund-confirmation] RESEND_API_KEY not set");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email service not configured" 
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get order and event details
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: order } = await supabase
      .from("orders")
      .select(`
        *,
        events:event_id (
          title,
          start_at,
          venue,
          city
        )
      `)
      .eq("id", order_id)
      .single();

    if (!order) {
      throw new Error("Order details not found");
    }

    const eventTitle = order.events?.title || "Event";
    const eventDate = order.events?.start_at ? 
      new Date(order.events.start_at).toLocaleDateString() : 
      "TBD";

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Liventix <tickets@liventix.com>",
        to: [email],
        subject: `Refund Processed - ${eventTitle}`,
        html: `
          <!DOCTYPE html>
          <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
              <h1 style="color: #333; margin-bottom: 10px;">Refund Processed</h1>
              <p style="color: #666; font-size: 18px; margin: 0;">
                Your refund has been successfully processed
              </p>
            </div>

            <div style="background: white; padding: 30px; margin-top: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
              <h2 style="color: #333; margin-top: 0;">Refund Details</h2>
              
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px 0; color: #666; border-bottom: 1px solid #f0f0f0;">Event</td>
                  <td style="padding: 12px 0; color: #333; font-weight: 600; border-bottom: 1px solid #f0f0f0; text-align: right;">${eventTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; color: #666; border-bottom: 1px solid #f0f0f0;">Event Date</td>
                  <td style="padding: 12px 0; color: #333; border-bottom: 1px solid #f0f0f0; text-align: right;">${eventDate}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; color: #666; border-bottom: 1px solid #f0f0f0;">Tickets Refunded</td>
                  <td style="padding: 12px 0; color: #333; border-bottom: 1px solid #f0f0f0; text-align: right;">${tickets_refunded || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; color: #666; border-bottom: 1px solid #f0f0f0;">Refund Amount</td>
                  <td style="padding: 12px 0; color: #10b981; font-weight: 700; font-size: 20px; border-bottom: 1px solid #f0f0f0; text-align: right;">$${refund_amount.toFixed(2)}</td>
                </tr>
                ${reason ? `
                <tr>
                  <td style="padding: 12px 0; color: #666;">Reason</td>
                  <td style="padding: 12px 0; color: #333; text-align: right;">${reason}</td>
                </tr>
                ` : ''}
              </table>

              <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 15px; margin-top: 20px;">
                <p style="margin: 0; color: #166534; font-size: 14px;">
                  💳 <strong>Refund Processing:</strong> The refund will appear in your account within 5-10 business days, depending on your bank.
                </p>
              </div>

              ${reason ? `
              <div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-radius: 8px; border: 1px solid #fbbf24;">
                <p style="margin: 0; color: #92400e; font-size: 14px;">
                  📝 We appreciate your feedback. If you have any concerns, please don't hesitate to reach out to us.
                </p>
              </div>
              ` : ''}
            </div>

            <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
              <p>Liventix - Your events, simplified</p>
              <p style="margin-top: 5px;">
                <a href="https://liventix.com/refund-policy" style="color: #666; text-decoration: none;">Refund Policy</a> • 
                <a href="https://liventix.com/support" style="color: #666; text-decoration: none;">Support</a>
              </p>
            </div>
          </body>
          </html>
        `
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(emailData)}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailId: emailData.id,
        sentTo: email
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("[send-refund-confirmation] ERROR:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
});
```

**Status:** ❌ Needs to be created

---

### **Phase 3: Frontend UI** ⏱️ 30 minutes

#### **Step 3.1: Add "Request Refund" Button**

**File:** `src/pages/new-design/TicketsPage.tsx` or similar

```typescript
// Add refund button to ticket card
<Button
  variant="outline"
  onClick={() => handleRefundRequest(ticket.order_id)}
  disabled={
    ticket.status === 'refunded' || 
    ticket.status === 'redeemed' ||
    isWithin24Hours(event.start_at)  // No refunds within 24h of event
  }
>
  Request Refund
</Button>

const handleRefundRequest = async (orderId: string) => {
  // Show confirmation dialog
  const confirmed = await confirm(
    "Are you sure you want to request a refund? This action cannot be undone."
  );
  
  if (!confirmed) return;

  try {
    const { data, error } = await supabase.functions.invoke('process-refund', {
      body: {
        order_id: orderId,
        reason: 'Customer request'
      }
    });

    if (error) throw error;

    toast({
      title: 'Refund Processed',
      description: `Your refund of $${data.refund.amount} has been initiated. You'll receive confirmation via email.`
    });

    // Refresh tickets list
    refetchTickets();
  } catch (err) {
    toast({
      title: 'Refund Failed',
      description: err.message,
      variant: 'destructive'
    });
  }
};
```

**Status:** ❌ Needs to be created

---

#### **Step 3.2: Show Refund Status**

```typescript
// In ticket card display
{ticket.status === 'refunded' && (
  <Badge variant="neutral">
    Refunded {formatDate(ticket.refunded_at)}
  </Badge>
)}
```

**Status:** ❌ Needs to be created

---

## 📊 **Implementation Summary**

### **What Already Works:**
| Component | System | Status | Location |
|-----------|--------|--------|----------|
| Wallet refund function | Wallets | ✅ Exists | `public.wallet_apply_refund` |
| Org wallet refund | Org wallets | ✅ Exists | `organizations.org_wallet_apply_refund` |
| Refund webhook handler | Wallets | ✅ Exists | `wallet-stripe-webhook/index.ts` |
| Invoice tracking | Wallets | ✅ Exists | `organizations.invoices` |

### **What Needs to Be Built:**
| Component | Purpose | Time | Difficulty |
|-----------|---------|------|------------|
| `process_ticket_refund` function | Database logic | 10 min | Easy |
| `refund_log` table | Audit trail | 5 min | Easy |
| Webhook handler update | Auto-refunds | 10 min | Easy |
| `process-refund` Edge Function | Manual refunds | 15 min | Medium |
| `send-refund-confirmation` | Email | 10 min | Easy |
| Refund UI components | User experience | 30 min | Medium |
| Integration testing | Verify it works | 15 min | Easy |
| **TOTAL** | **Complete automation** | **~95 min** | **Medium** |

---

## 🎯 **Recommendation**

### **For Launch: Keep Manual Ticket Refunds** ⏩

**Reasoning:**
- ✅ Wallet refunds are automated (shows system works)
- ✅ Ticket refunds are rare (<5% of transactions typically)
- ✅ Can process manually in ~2 minutes per refund
- ✅ Build automation after launch when you have real data

**Manual Process:**
```
1. Admin processes refund in Stripe Dashboard
2. Run SQL: UPDATE tickets SET status='refunded' WHERE order_id='xxx'
3. Run SQL: UPDATE ticket_tiers SET issued_quantity = issued_quantity - 1 WHERE id='xxx'
4. (Optional) Send manual email
```

### **Post-Launch: Build Automated Ticket Refunds** 🔧

**Timeline:** Month 2, after first 100 orders  
**Effort:** ~2 hours total (including testing)  
**Priority:** Medium (nice to have, not critical)

---

## ✅ **Current Refund Capabilities**

```
Wallet/Credit Purchases:    ✅ Fully Automated
Sponsorship Purchases:      ✅ Fully Automated  
Ticket Purchases:           ❌ Manual Only

Overall Refund Coverage:    ~33% automated
```

---

**Saved to:** `REFUND_SYSTEM_ANALYSIS.md`

**Decision:** Want to build automated ticket refunds now (95 min) or launch with manual refunds? 🤔



