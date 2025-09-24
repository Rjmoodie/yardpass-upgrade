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
    const requestBody = await req.json();
    console.log('📥 Request body received:', JSON.stringify(requestBody, null, 2));
    
    // Handle both old format (from TicketPurchaseModal) and new format
    let order_data: any, payout_destination: any;
    let supabaseService: any;
    
    console.log('🔍 Checking request format...');
    if (requestBody.eventId && requestBody.ticketSelections) {
      console.log('✅ Old format detected, converting...');
      // Old format from TicketPurchaseModal - convert to new format
      const { eventId, ticketSelections } = requestBody;
      
      // Get user from auth
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("No authorization header provided");
      
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      
      const token = authHeader.replace("Bearer ", "").trim();
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError || !userData.user) throw new Error("User not authenticated");
      
      // Convert to enhanced-checkout format
      order_data = {
        event_id: eventId,
        user_id: userData.user.id,
        items: ticketSelections.map((sel: any) => ({
          tier_id: sel.tierId,
          quantity: sel.quantity,
          unit_price_cents: sel.faceValue,
          name: `Ticket - ${sel.tierId.substring(0, 8)}`,
          description: `Event ticket`
        }))
      };
      
      // Get payout destination for the event
      supabaseService = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );
      
      const { data: event } = await supabaseService
        .from("events")
        .select("owner_context_type, owner_context_id")
        .eq("id", eventId)
        .single();
        
      if (event) {
        const { data: payoutAccount } = await supabaseService
          .from("payout_accounts")
          .select("*")
          .eq("context_type", event.owner_context_type)
          .eq("context_id", event.owner_context_id)
          .single();
        
        payout_destination = payoutAccount;
      }
    } else {
      console.log('🔄 New format detected');
      // New format
      ({ order_data, payout_destination } = requestBody);
    }

    console.log('📊 Final order_data:', JSON.stringify(order_data, null, 2));
    console.log('💳 Final payout_destination:', JSON.stringify(payout_destination, null, 2));

    if (!order_data) {
      throw new Error("Order data is required");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Initialize Supabase service client
    supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Reserve tickets atomically using the new system
    console.log('🔒 Attempting atomic ticket reservation...');
    const reservationItems = order_data.items.map((item: any) => ({
      tier_id: item.tier_id,
      quantity: item.quantity
    }));

    const { data: reservationResult, error: reservationError } = await supabaseService
      .rpc('reserve_tickets_batch', {
        p_user_id: order_data.user_id,
        p_items: reservationItems,
        p_expires_minutes: 15
      });

    if (reservationError || !reservationResult?.success) {
      console.error('❌ Ticket reservation failed:', reservationError || reservationResult?.error);
      throw new Error(reservationResult?.error || 'Failed to reserve tickets');
    }

    console.log('✅ Tickets reserved successfully:', reservationResult);

    // Calculate amounts using the specified fee structure
    const faceValueCents = order_data.items.reduce((total: number, item: any) => {
      return total + (item.unit_price_cents * item.quantity);
    }, 0);
    const faceValue = faceValueCents / 100;

    // Fee formula: processingFee = (faceValue * 0.037) + 1.89 + (faceValue * 0.029) + 0.30
    // Simplified: processingFee = faceValue * 0.066 + 2.19
    const processingFee = faceValue * 0.066 + 2.19;
    const totalAmount = faceValue + processingFee;
    const totalCents = Math.round(totalAmount * 100);
    const applicationFeeCents = Math.round(processingFee * 100);

    // Create checkout session with destination charges if payout account exists
    const sessionConfig: any = {
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${order_data.items.map((i: any) => i.name).join(', ')}`,
            description: `Event tickets (includes processing fees)`,
          },
          unit_amount: totalCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.headers.get("origin")}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/events/${order_data.event_id}`,
      metadata: {
        event_id: order_data.event_id,
        user_id: order_data.user_id,
        platform_fee: applicationFeeCents.toString(),
        hold_ids: JSON.stringify(reservationResult.hold_ids || []),
      },
    };

    // Add destination charges if payout account is set up
    if (payout_destination?.stripe_connect_id && payout_destination?.payouts_enabled) {
      sessionConfig.payment_intent_data = {
        application_fee_amount: applicationFeeCents,
        transfer_data: {
          destination: payout_destination.stripe_connect_id,
        },
      };
      
      console.log(`Setting up destination charge: ${faceValueCents}¢ to ${payout_destination.stripe_connect_id}, fee: ${applicationFeeCents}¢`);
    } else {
      console.log("No payout destination configured, processing as regular payment");
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // Store order in database
    const { data: order, error: orderError } = await supabaseService
      .from('orders')
      .insert({
        event_id: order_data.event_id,
        user_id: order_data.user_id,
        stripe_session_id: session.id,
        status: 'pending',
        currency: 'USD',
        subtotal_cents: faceValueCents,
        fees_cents: applicationFeeCents,
        total_cents: totalCents,
        payout_destination_owner: payout_destination?.context_type,
        payout_destination_id: payout_destination?.context_id,
        hold_ids: reservationResult.hold_ids || [],
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order creation error:', orderError);
      throw orderError;
    }

    // Store order items
    const orderItems = order_data.items.map((item: any) => ({
      order_id: order.id,
      tier_id: item.tier_id,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
    }));

    const { error: itemsError } = await supabaseService
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items creation error:', itemsError);
      throw itemsError;
    }

    return new Response(
      JSON.stringify({
        session_id: session.id,
        session_url: session.url,
        order_id: order.id,
        total_amount: totalCents,
        platform_fee: applicationFeeCents,
        destination_account: payout_destination?.stripe_connect_id || null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in enhanced-checkout:', error);
    
    // Error occurred - simplified error handling
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: (error as any)?.message || 'Unknown error',
        error_code: 'CHECKOUT_FAILED'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});