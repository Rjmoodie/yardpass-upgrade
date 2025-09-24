import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { sessionId, holdIds } = await req.json();
    
    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    console.log(`💳 Processing payment success for session: ${sessionId}`);

    // Initialize Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get the order
    const { data: order, error: orderError } = await supabaseService
      .from('orders')
      .select('*')
      .eq('stripe_session_id', sessionId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found for session: ${sessionId}`);
    }

    // Get order items
    const { data: orderItems, error: itemsError } = await supabaseService
      .from('order_items')
      .select('*')
      .eq('order_id', order.id);

    if (itemsError || !orderItems) {
      throw new Error(`Order items not found for order: ${order.id}`);
    }

    console.log(`🎫 Processing ${orderItems.length} order items`);

    // Consume holds atomically
    const consumeItems = orderItems.map(item => ({
      tier_id: item.tier_id,
      quantity: item.quantity
    }));

    const { data: consumeResult, error: consumeError } = await supabaseService
      .rpc('consume_tickets_batch', {
        p_user_id: order.user_id,
        p_items: consumeItems
      });

    if (consumeError || !consumeResult?.success) {
      console.error('❌ Failed to consume tickets:', consumeError || consumeResult?.error);
      throw new Error(consumeResult?.error || 'Failed to consume tickets');
    }

    console.log('✅ Tickets consumed successfully');

    // Mark order as paid
    const { error: updateError } = await supabaseService
      .from('orders')
      .update({ 
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('❌ Failed to update order status:', updateError);
      throw updateError;
    }

    // Create tickets
    const ticketsToCreate = [];
    for (const item of orderItems) {
      for (let i = 0; i < item.quantity; i++) {
        ticketsToCreate.push({
          event_id: order.event_id,
          tier_id: item.tier_id,
          order_id: order.id,
          owner_user_id: order.user_id,
          status: 'issued'
        });
      }
    }

    const { error: ticketsError } = await supabaseService
      .from('tickets')
      .insert(ticketsToCreate);

    if (ticketsError) {
      console.error('❌ Failed to create tickets:', ticketsError);
      throw ticketsError;
    }

    console.log(`✅ Created ${ticketsToCreate.length} tickets`);

    // Log the operation
    const { error: logError } = await supabaseService
      .from('inventory_operations')
      .insert({
        operation_type: 'payment_success',
        user_id: order.user_id,
        metadata: {
          order_id: order.id,
          session_id: sessionId,
          tickets_created: ticketsToCreate.length,
          processed_at: new Date().toISOString()
        }
      });

    if (logError) {
      console.warn('⚠️ Failed to log operation:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        tickets_created: ticketsToCreate.length,
        message: 'Payment processed successfully'
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('❌ Payment success handler error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as any)?.message || 'Unknown error',
        error_code: 'PAYMENT_SUCCESS_FAILED'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});