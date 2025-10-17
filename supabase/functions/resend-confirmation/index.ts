import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[RESEND-CONFIRMATION] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    logStep("Function started");

    const { orderId } = await req.json();
    if (!orderId) {
      throw new Error("orderId is required");
    }
    logStep("Order ID provided", { orderId });

    // Create Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get order details
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
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      logStep("Order not found", { error: orderError?.message });
      throw new Error("Order not found");
    }

    logStep("Order found", { orderId: order.id, status: order.status });

    if (order.status !== 'paid') {
      throw new Error("Order must be paid to send confirmation email");
    }

    // Get user profile
    const { data: userProfile } = await supabaseService
      .from("user_profiles")
      .select("display_name")
      .eq("user_id", order.user_id)
      .single();

    // Try to get email from auth.users, fallback to order contact_email
    let userEmail = order.contact_email;
    
    try {
      const { data: authUser } = await supabaseService.auth.admin.listUsers();
      const user = authUser?.users?.find(u => u.id === order.user_id);
      if (user?.email) {
        userEmail = user.email;
      }
    } catch (authError: any) {
      logStep("Auth admin lookup failed, using contact_email", { error: authError.message });
    }

    if (!userEmail) {
      throw new Error("No email address found for user");
    }

    logStep("User email found", { email: userEmail });

    // Get tickets
    const { data: tickets } = await supabaseService
      .from("tickets")
      .select("id")
      .eq("order_id", order.id);
    
    const ticketIds = (tickets || []).map(t => t.id);
    const ticketCount = ticketIds.length;

    logStep("Tickets found", { count: ticketCount });

    // Get first ticket tier name
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

    logStep("Sending purchase confirmation email", { email: userEmail });

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
        eventId: order.event_id,
      }
    });

    if (emailResponse.error) {
      logStep("Email sending failed", { error: emailResponse.error });
      throw new Error(`Email sending failed: ${emailResponse.error.message}`);
    }

    logStep("Purchase confirmation email sent successfully", { 
      emailId: emailResponse.data?.id,
      to: userEmail 
    });

    return createResponse({
      success: true,
      emailId: emailResponse.data?.id,
      sentTo: userEmail,
      ticketsCount: ticketCount
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in resend-confirmation", { message: errorMessage });
    return createErrorResponse(errorMessage);
  }
});



