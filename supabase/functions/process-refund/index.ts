import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[process-refund] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, reason } = await req.json();
    
    if (!order_id) {
      throw new Error("order_id is required");
    }

    logStep("Refund request received", { orderId: order_id, reason });

    // ============================================================================
    // 1. AUTHENTICATE USER (Get from JWT)
    // ============================================================================
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization required");
    }

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from JWT
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      authHeader.replace("Bearer ", ""),
      { auth: { persistSession: false } }
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      throw new Error("Authentication failed");
    }

    logStep("User authenticated", { userId: user.id });

    // ============================================================================
    // 2. GET ORDER AND CHECK PERMISSIONS
    // ============================================================================
    
    const { data: order, error: orderErr } = await supabaseService
      .from("orders")
      .select(`
        *,
        events:event_id (
          id,
          title,
          start_at,
          created_by,
          owner_context_type,
          owner_context_id
        )
      `)
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      throw new Error(`Order not found: ${order_id}`);
    }

    logStep("Order found", { 
      orderId: order.id, 
      eventTitle: order.events?.title,
      status: order.status 
    });

    // ============================================================================
    // 3. CHECK AUTHORIZATION
    // ============================================================================
    
    // Check if user is authorized to refund this order
    const isOrderOwner = order.user_id === user.id;
    const isEventCreator = order.events?.created_by === user.id;
    
    // Check if platform admin
    const { data: userProfile } = await supabaseService
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();
    
    const isPlatformAdmin = userProfile?.is_admin === true;

    // Check if org admin (for org events)
    let isOrgAdmin = false;
    if (order.events?.owner_context_type === 'organization') {
      const { data: orgMember } = await supabaseService
        .from('org_members')
        .select('role')
        .eq('org_id', order.events.owner_context_id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      isOrgAdmin = orgMember?.role === 'admin' || orgMember?.role === 'owner';
    }

    const isAuthorized = isEventCreator || isOrgAdmin || isPlatformAdmin;

    if (!isAuthorized) {
      logStep("❌ Authorization failed", {
        userId: user.id,
        isOrderOwner,
        isEventCreator,
        isOrgAdmin,
        isPlatformAdmin
      });
      throw new Error("Not authorized to refund this order. Only event organizers and platform admins can process refunds.");
    }

    logStep("✅ Authorization passed", {
      isEventCreator,
      isOrgAdmin,
      isPlatformAdmin
    });

    // ============================================================================
    // 4. CHECK REFUND ELIGIBILITY (Business Rules)
    // ============================================================================
    
    const { data: eligibility, error: eligErr } = await supabaseService
      .rpc('check_refund_eligibility', {
        p_order_id: order.id,
        p_user_id: user.id
      });

    if (eligErr) {
      throw new Error(`Eligibility check failed: ${eligErr.message}`);
    }

    if (!eligibility?.eligible) {
      logStep("❌ Order not eligible for refund", { 
        reason: eligibility?.reason 
      });
      return new Response(
        JSON.stringify({
          status: 'not_eligible',
          reason: eligibility?.reason || 'Refund not allowed',
          details: eligibility
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    logStep("✅ Eligibility check passed");

    // ============================================================================
    // 5. PROCESS STRIPE REFUND
    // ============================================================================

    if (!order.stripe_payment_intent_id) {
      throw new Error("No Stripe payment intent found for this order");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-06-20"
    });

    logStep("Creating Stripe refund", { 
      paymentIntent: order.stripe_payment_intent_id,
      amount: order.total_cents / 100
    });

    // Create refund in Stripe (full order only for v1)
    const refund = await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      amount: order.total_cents,  // ✅ Full refund only (v1)
      reason: 'requested_by_customer',
      metadata: {
        order_id: order.id,
        event_id: order.event_id,
        refund_reason: reason || 'Refund requested',
        refund_type: isEventCreator || isOrgAdmin ? 'organizer' : 'admin',
        initiated_by: user.id,
        initiated_by_email: user.email
      }
    });

    logStep("✅ Stripe refund created", { 
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status
    });

    // ============================================================================
    // 6. UPDATE DATABASE (Idempotent - webhook will also try, but won't duplicate)
    // ============================================================================
    
    const { data: dbResult, error: dbErr } = await supabaseService
      .rpc('process_ticket_refund', {
        p_order_id: order.id,
        p_refund_amount_cents: order.total_cents,
        p_stripe_refund_id: refund.id,
        p_stripe_event_id: null,  // Webhook will set this when it arrives
        p_reason: reason || 'Refund requested',
        p_refund_type: isEventCreator || isOrgAdmin ? 'organizer' : 'admin',
        p_initiated_by: user.id
      });

    if (dbErr) {
      logStep("⚠️ DB update failed (webhook will complete it)", { error: dbErr.message });
      // Stripe refund succeeded - that's what matters
      // Webhook will complete the DB update when it arrives
    } else {
      logStep("✅ Database updated immediately", {
        ticketsRefunded: dbResult?.tickets_refunded,
        inventoryReleased: dbResult?.inventory_released
      });
    }

    // ✅ Return success
    // Note: Email will be sent by webhook for consistency (single source)
    return new Response(
      JSON.stringify({
        status: 'success',
        refund: {
          id: refund.id,
          amount: order.total_cents / 100,
          status: refund.status
        },
        database: {
          tickets_refunded: dbResult?.tickets_refunded || 'pending_webhook',
          inventory_released: dbResult?.inventory_released || 'pending_webhook'
        },
        message: 'Refund initiated successfully. Confirmation email will be sent shortly.'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    logStep("❌ ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ 
        status: 'error',
        error: error.message || "Refund processing failed" 
      }),
      { 
        status: error.message?.includes("Not authorized") ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

