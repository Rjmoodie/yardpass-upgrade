import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2023-10-16",
    });

    // Get the Authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Verify the user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { orderId } = await req.json();

    console.log('Processing payout for order:', orderId);

    const { data: order, error: oErr } = await supabase
      .from("sponsorship_orders")
      .select(`
        *,
        events!inner(owner_context_type, owner_context_id, title)
      `)
      .eq("id", orderId)
      .single();

    if (oErr || !order) {
      console.error('Order not found:', oErr);
      return new Response("Order not found", { status: 404 });
    }

    if (order.status !== "escrow") {
      return new Response("Not ready for payout", { status: 400 });
    }

    const { data: conn } = await supabase
      .from("event_connect")
      .select("stripe_connect_account_id")
      .eq("event_id", order.event_id)
      .maybeSingle();

    if (!conn?.stripe_connect_account_id) {
      return new Response("No connect account", { status: 400 });
    }

    const netToOrganizer = order.amount_cents - order.application_fee_cents;
    if (netToOrganizer <= 0) {
      return new Response("Nothing to transfer", { status: 400 });
    }

    console.log('Creating transfer:', {
      amount: netToOrganizer,
      destination: conn.stripe_connect_account_id,
      transferGroup: order.transfer_group
    });

    const transfer = await stripe.transfers.create({
      amount: netToOrganizer,
      currency: order.currency,
      destination: conn.stripe_connect_account_id,
      transfer_group: order.transfer_group || undefined,
      metadata: { 
        order_id: order.id, 
        event_id: order.event_id 
      },
    });

    await supabase
      .from("sponsorship_orders")
      .update({ 
        status: "paid", 
        stripe_transfer_id: transfer.id, 
        updated_at: new Date().toISOString() 
      })
      .eq("id", order.id);

    console.log('Payout completed:', transfer.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        transferId: transfer.id,
        amount: netToOrganizer 
      }),
      {
        headers: { ...corsHeaders, "content-type": "application/json" },
      }
    );

  } catch (error) {
    console.error('Error in sponsor-payout:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "content-type": "application/json" },
        status: 500,
      }
    );
  }
});