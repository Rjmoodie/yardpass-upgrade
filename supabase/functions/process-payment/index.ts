import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

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
      // Get user profile for email
      const { data: userProfile } = await supabaseService
        .from("user_profiles")
        .select("display_name, email")
        .eq("user_id", order.user_id)
        .single();

      if (userProfile?.email) {
        logStep("Sending purchase confirmation email", { email: userProfile.email });

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
            customerName: userProfile.display_name || 'Customer',
            customerEmail: userProfile.email,
            eventTitle: order.events?.title || 'Event',
            eventDate,
            eventLocation,
            ticketType,
            quantity: ticketCount,
            totalAmount: order.total_cents,
            orderId: order.id,
            ticketIds,
            eventId: order.event_id, // This will trigger auto-fetch of org/event context
          }
        });

        if (emailResponse.error) {
          logStep("Email sending failed (non-critical)", { error: emailResponse.error });
        } else {
          logStep("Purchase confirmation email sent successfully");
        }
      } else {
        logStep("No email address found for user", { userId: order.user_id });
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