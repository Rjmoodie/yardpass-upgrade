# 🔧 Minimal DLQ Patch for stripe-webhook

Instead of replacing the entire file, add this small patch to your existing code.

---

## Step 1: Add enqueueWithDLQ function (add at top, after imports)

```typescript
// Add this function after your imports, before serve()
async function enqueueWithDLQ(
  supabaseClient: any,
  eventId: string,
  eventType: string,
  payload: any,
  headers: Record<string, string>,
  errorMessage: string
): Promise<void> {
  const nextRetryAt = new Date(Date.now() + 60000).toISOString(); // 1 minute delay
  
  const { error } = await supabaseClient
    .from("webhook_retry_queue")
    .insert({
      webhook_type: 'stripe',
      event_id: eventId,
      event_type: eventType,
      payload: payload,
      headers: headers,
      error_message: errorMessage,
      correlation_id: crypto.randomUUID(),
      max_attempts: 5,
      status: 'pending',
      next_retry_at: nextRetryAt,
      attempts: 0,
      metadata: {
        enqueued_at: new Date().toISOString(),
      },
    });

  if (error) {
    console.error("Failed to enqueue webhook to DLQ:", error);
    throw error;
  }
}
```

---

## Step 2: Modify the catch block (replace existing catch block)

Find this in your existing code:
```typescript
} catch (error: any) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logStep("ERROR in stripe-webhook", { message: errorMessage, eventId });
  
  // Update webhook event record as failed (if we have the event ID)
  if (eventId) {
    try {
      const supabaseService = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
        auth: { persistSession: false }
      });
      await supabaseService.from("stripe_webhook_events").update({
        success: false,
        error_message: errorMessage
      }).eq("stripe_event_id", eventId);
    } catch (updateErr) {
      logStep("⚠️ Failed to update webhook event record", { error: updateErr });
    }
  }

  return new Response(JSON.stringify({ error: errorMessage }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
```

**Replace with:**
```typescript
} catch (error: any) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logStep("ERROR in stripe-webhook", { message: errorMessage, eventId });
  
  // 🔄 NEW: Enqueue failed webhook to retry queue
  if (eventId) {
    try {
      const supabaseService = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );

      // Try to parse event from body if we have it
      let payload: any = null;
      if (eventBody) {
        try {
          payload = JSON.parse(eventBody);
        } catch {
          payload = { raw_body: eventBody };
        }
      }

      await enqueueWithDLQ(
        supabaseService,
        eventId,
        eventType || 'unknown',
        payload || { error: 'failed_to_parse' },
        eventHeaders,
        errorMessage
      );
      
      logStep("✅ Failed webhook enqueued for retry", { eventId, eventType });
    } catch (dlqError: any) {
      logStep("⚠️ Failed to enqueue webhook to DLQ", { error: dlqError });
    }
  }

  // Update webhook event record as failed
  if (eventId) {
    try {
      const supabaseService = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );
      await supabaseService.from("stripe_webhook_events").update({
        success: false,
        error_message: errorMessage
      }).eq("stripe_event_id", eventId);
    } catch (updateErr) {
      logStep("⚠️ Failed to update webhook event record", { error: updateErr });
    }
  }

  // ⚠️ IMPORTANT: Return 200 OK even on error
  // This tells Stripe "we received it, don't retry"
  // We handle retries internally via the webhook_retry_queue
  return new Response(JSON.stringify({
    received: true,
    error: errorMessage,
    note: "Webhook queued for retry"
  }), {
    status: 200, // ✅ Changed from 500 to 200
    headers: { "Content-Type": "application/json" }
  });
}
```

---

## Step 3: Add variables at top of serve() function

At the very start of your `serve(async (req) => {` function, add:

```typescript
serve(async (req) => {
  console.log("=== WEBHOOK CALLED ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);
  
  // Add these variables for DLQ
  let eventId: string | null = null;
  let eventBody: string | null = null;
  let eventHeaders: Record<string, string> = {};
  let eventType: string | null = null;

  try {
    // ... rest of your existing code
```

---

## Step 4: Store body and headers before processing

Find where you do `const body = await req.text();` and change to:

```typescript
// Store body and headers BEFORE processing (for DLQ if needed)
eventBody = await req.text();
const signature = req.headers.get("stripe-signature");

// Store headers for retry queue
eventHeaders = {
  'stripe-signature': signature || '',
  'content-type': req.headers.get('content-type') || 'application/json',
};

if (!signature) {
  logStep("No Stripe signature found in request headers");
  throw new Error("No Stripe signature found");
}
```

---

## Step 5: Store event ID and type after verification

After you verify the event, add:

```typescript
event = await stripe.webhooks.constructEventAsync(eventBody, signature, webhookSecret);
eventId = event.id;        // Add this
eventType = event.type;    // Add this
logStep("✅ Event verified successfully", { type: event.type, id: event.id });
```

---

## ✅ Summary

This patch adds DLQ support with minimal changes:
- ✅ Adds `enqueueWithDLQ()` helper function
- ✅ Stores `eventBody`, `eventHeaders`, `eventId`, `eventType` for retry
- ✅ Enqueues failed webhooks in catch block
- ✅ Returns 200 OK instead of 500 (so Stripe doesn't retry)

**Total additions:** ~50 lines, easy to add manually!

