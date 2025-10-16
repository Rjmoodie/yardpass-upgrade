import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Shared utilities (copied from _shared/cors.ts and _shared/checkout-session.ts)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
}

function createResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function createErrorResponse(error: string, status = 400) {
  return createResponse({ error }, status);
}

export const updateCheckoutSession = async (
  client: any,
  id: string,
  patch: any,
): Promise<void> => {
  const updateRecord: Record<string, unknown> = {};

  if (patch.status !== undefined) updateRecord.status = patch.status;
  if (patch.verificationState !== undefined) updateRecord.verification_state = patch.verificationState;
  if (patch.expressMethods !== undefined) updateRecord.express_methods = patch.expressMethods;
  if (patch.pricingSnapshot !== undefined) updateRecord.pricing_snapshot = patch.pricingSnapshot;
  if (patch.stripeSessionId !== undefined) updateRecord.stripe_session_id = patch.stripeSessionId;
  if (patch.contactSnapshot !== undefined) updateRecord.contact_snapshot = patch.contactSnapshot;

  if (patch.expiresAt !== undefined) {
    updateRecord.expires_at = patch.expiresAt instanceof Date ? patch.expiresAt.toISOString() : patch.expiresAt;
  }

  if (!Object.keys(updateRecord).length) {
    return;
  }

  const { error } = await client
    .from("checkout_sessions")
    .update(updateRecord)
    .eq("id", id);

  if (error) {
    console.error("[checkout-session] update failed", error);
    throw error;
  }
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    logStep("Function started");

    const { sessionId } = await req.json();
    if (!sessionId) {
      throw new Error("sessionId is required");
    }
    logStep("Session ID provided", { sessionId });

    // Create Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Find the order by session ID with better error handling
    const { data: order, error: orderError } = await supabaseService
      .from("orders")
      .select(`
        *,
        events!orders_event_id_fkey (
          title,
          start_at,
          venue,
          city
        )
      `)
      .eq("stripe_session_id", sessionId)
      .maybeSingle(); // Use maybeSingle instead of single for better error handling

    if (orderError) {
      logStep("Database error finding order", { error: orderError.message });
      throw new Error(`Database error: ${orderError.message}`);
    }

    if (!order) {
      logStep("Order not found", { sessionId });
      throw new Error("Order not found for this session");
    }

    logStep("Order found", { orderId: order.id, status: order.status });

    // Mark order as paid first
    const { error: updateError } = await supabaseService
      .from("orders")
      .update({
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq("id", order.id);

    if (updateError) {
      logStep("Failed to update order", { error: updateError.message });
      throw new Error("Failed to update order status");
    }

    logStep("Order marked as paid");

    if (order.checkout_session_id) {
      try {
        const { data: checkoutSession } = await supabaseService
          .from("checkout_sessions")
          .select("verification_state")
          .eq("id", order.checkout_session_id)
          .maybeSingle();

        const nextVerification = {
          ...(checkoutSession?.verification_state ?? {}),
          email_verified: true,
          risk_score: checkoutSession?.verification_state?.risk_score ?? 0,
        };

        await updateCheckoutSession(supabaseService, order.checkout_session_id, {
          status: "converted",
          verificationState: nextVerification,
          stripeSessionId: sessionId,
        });
      } catch (sessionUpdateError) {
        console.warn("[PROCESS-PAYMENT] checkout session update failed", sessionUpdateError);
      }
    }

    // Use ensure-tickets function for idempotent ticket creation
    const ensureTicketsResponse = await supabaseService.functions.invoke('ensure-tickets', {
      body: { order_id: order.id }
    });

    if (ensureTicketsResponse.error) {
      logStep("Ensure tickets failed", { error: ensureTicketsResponse.error });
      throw new Error(`Failed to ensure tickets: ${ensureTicketsResponse.error.message}`);
    }

    const ticketCount = ensureTicketsResponse.data?.issued || ensureTicketsResponse.data?.already_issued || 0;
    
    // Get ticket IDs for email
    const { data: tickets } = await supabaseService
      .from("tickets")
      .select("id")
      .eq("order_id", order.id);
    
    const ticketIds = (tickets || []).map(t => t.id);

    logStep("Tickets ensured", { count: ticketCount });

    // Send purchase confirmation email
    try {
      // Get user profile
      const { data: userProfile } = await supabaseService
        .from("user_profiles")
        .select("display_name")
        .eq("user_id", order.user_id)
        .single();

      // Try to get email from auth.users, fallback to order contact_email
      let userEmail = order.contact_email; // Default fallback
      
      try {
        const { data: authUser } = await supabaseService.auth.admin.listUsers();
        const user = authUser?.users?.find(u => u.id === order.user_id);
        if (user?.email) {
          userEmail = user.email;
        }
      } catch (authError) {
        logStep("Auth admin lookup failed, using contact_email", { error: authError.message });
        // userEmail already set to order.contact_email
      }

      if (userEmail) {
        logStep("Sending purchase confirmation email", { email: userEmail });

        // Get first ticket tier name for the email
        const { data: firstTier } = await supabaseService
          .from("order_items")
          .select("ticket_tiers(name)")
          .eq("order_id", order.id)
          .limit(1)
          .maybeSingle();
        
        const ticketType = firstTier?.ticket_tiers?.name || "General Admission";
        
        // Format event date
        const eventDate = order.events?.start_at 
          ? new Date(order.events.start_at).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit'
            })
          : 'TBA';

        const eventLocation = [order.events?.venue, order.events?.city]
          .filter(Boolean)
          .join(', ') || 'TBA';

        // Call send-purchase-confirmation edge function
        const emailResponse = await supabaseService.functions.invoke('send-purchase-confirmation', {
          body: {
            customerName: userProfile?.display_name || order.contact_name || 'Customer',
            customerEmail: userEmail,
            eventTitle: order.events?.title || 'Event',
            eventDate,
            eventLocation,
            ticketType,
            quantity: ticketCount,
            totalAmount: order.total_cents,
            orderId: order.id,
            ticketIds,
            eventId: order.event_id, // This will trigger auto-fetch of org/event context
            isGuest: !order.user_id || (userProfile?.display_name === 'User'),
            userId: order.user_id,
          }
        });

        if (emailResponse.error) {
          logStep("Email sending failed (non-critical)", { error: emailResponse.error });
        } else {
          logStep("Purchase confirmation email sent successfully", { 
            emailId: emailResponse.data?.id,
            to: userEmail 
          });
        }
      } else {
        logStep("No email address found for user", { 
          userId: order.user_id,
          contactEmail: order.contact_email 
        });
      }
    } catch (emailError) {
      // Don't fail the whole payment if email fails
      logStep("Email error (non-critical)", { error: emailError });
    }

    logStep("Payment processed successfully", { 
      orderId: order.id, 
      ticketsCreated: ticketCount 
    });

    return createResponse({
      order: {
        id: order.id,
        event_title: order.events?.title || "Event",
        event_start_at: order.events?.start_at,
        event_venue: order.events?.venue,
        event_city: order.events?.city,
        tickets_count: ticketCount,
        total_amount: order.total_cents / 100,
        status: 'paid'
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in process-payment", { message: errorMessage });
    return createErrorResponse(errorMessage);
  }
});