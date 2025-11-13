import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[submit-refund-request] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, reason, details } = await req.json();
    
    if (!order_id || !reason) {
      throw new Error("order_id and reason are required");
    }

    // ========================================================================
    // 1. AUTHENTICATE USER
    // ========================================================================
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authentication required");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      authHeader.replace("Bearer ", ""),
      { auth: { persistSession: false } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      throw new Error("Authentication failed");
    }

    logStep("User authenticated", { userId: user.id, orderId: order_id });

    // Use service role for operations
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // ========================================================================
    // 2. VALIDATE ORDER BELONGS TO USER
    // ========================================================================
    
    const { data: order, error: orderErr } = await supabaseService
      .from("orders")
      .select(`
        *,
        events:event_id(id, title, start_at)
      `)
      .eq("id", order_id)
      .eq("user_id", user.id)  // ✅ Security: only their orders
      .single();

    if (orderErr || !order) {
      throw new Error("Order not found or you don't have permission");
    }

    logStep("Order validated", { 
      eventTitle: order.events?.title,
      status: order.status,
      totalCents: order.total_cents
    });

    // ========================================================================
    // 3. CHECK IF ALREADY REFUNDED
    // ========================================================================
    
    if (order.status === 'refunded') {
      return new Response(
        JSON.stringify({
          status: 'already_refunded',
          message: 'This order has already been refunded'
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // 4. CHECK IF REQUEST ALREADY EXISTS
    // ========================================================================
    
    const { data: existingRequest } = await supabaseService
      .from("refund_requests")
      .select("id, status")
      .eq("order_id", order_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingRequest) {
      return new Response(
        JSON.stringify({
          status: 'already_requested',
          message: 'A refund request is already pending for this order',
          request_id: existingRequest.id
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // 5. CHECK BASIC ELIGIBILITY
    // ========================================================================
    
    const { data: eligibility, error: eligErr } = await supabaseService
      .rpc('check_refund_eligibility', {
        p_order_id: order.id,
        p_user_id: user.id
      });

    if (eligErr) {
      throw new Error(`Eligibility check failed: ${eligErr.message}`);
    }

    if (!eligibility?.eligible) {
      logStep("Not eligible", { reason: eligibility?.reason });
      return new Response(
        JSON.stringify({
          status: 'not_eligible',
          reason: eligibility?.reason || 'Refund not allowed',
          details: eligibility
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // 6. CHECK AUTO-APPROVE (if enabled for this event)
    // ========================================================================
    
    const { data: autoApproveCheck, error: autoErr } = await supabaseService
      .rpc('should_auto_approve_refund', {
        p_order_id: order.id,
        p_user_id: user.id
      });

    if (autoErr) {
      logStep("Auto-approve check failed (will default to manual)", { error: autoErr.message });
    }

    const shouldAutoApprove = autoApproveCheck?.auto_approve === true;

    logStep("Auto-approve check", {
      enabled: shouldAutoApprove,
      reason: autoApproveCheck?.reason
    });

    // ========================================================================
    // 7. CREATE REFUND REQUEST
    // ========================================================================
    
    const requestStatus = shouldAutoApprove ? 'approved' : 'pending';

    const { data: request, error: insertErr } = await supabaseService
      .from("refund_requests")
      .insert({
        order_id,
        user_id: user.id,
        reason,
        details: details?.trim() || null,
        status: requestStatus,
        metadata: {
          event_title: order.events?.title,
          event_start: order.events?.start_at,
          order_total_cents: order.total_cents,
          auto_approve_check: autoApproveCheck,
          auto_approved: shouldAutoApprove
        }
      })
      .select()
      .single();

    if (insertErr) {
      throw new Error(`Failed to create request: ${insertErr.message}`);
    }

    logStep("Request created", { requestId: request.id, status: requestStatus });

    // ========================================================================
    // 8. IF AUTO-APPROVED, PROCESS REFUND IMMEDIATELY
    // ========================================================================
    
    if (shouldAutoApprove) {
      logStep("Auto-approving request", { requestId: request.id });

      try {
        // Process refund via existing function (as service role to bypass auth)
        const refundResponse = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-refund`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              order_id: order.id,
              reason: `Auto-approved customer request: ${reason}${details ? ' - ' + details : ''}`,
              _bypass_auth: true  // Internal flag
            })
          }
        );

        const refundData = await refundResponse.json();

        if (!refundResponse.ok || refundData.status === 'error') {
          throw new Error(refundData.error || 'Refund processing failed');
        }

        logStep("Auto-approve refund processed", { 
          refundId: refundData.refund?.id 
        });

        // Update request to processed
        const { data: refundLog } = await supabaseService
          .from("refund_log")
          .select("id")
          .eq("order_id", order.id)
          .order("processed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        await supabaseService
          .from("refund_requests")
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            reviewed_by: null,  // System auto-approved
            organizer_response: 'Automatically approved',
            refund_log_id: refundLog?.id
          })
          .eq("id", request.id);

        // Return immediate success
        return new Response(
          JSON.stringify({
            status: 'auto_approved',
            request_id: request.id,
            refund: refundData?.refund,
            message: 'Your refund has been automatically approved! You will receive confirmation via email shortly.'
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );

      } catch (refundErr: any) {
        logStep("Auto-approve failed, reverting to manual review", { 
          error: refundErr.message 
        });

        // Revert to pending for manual review
        await supabaseService
          .from("refund_requests")
          .update({ 
            status: 'pending',
            metadata: {
              ...request.metadata,
              auto_approve_failed: true,
              auto_approve_error: refundErr.message
            }
          })
          .eq("id", request.id);

        // Return as pending
        return new Response(
          JSON.stringify({
            status: 'pending',
            request_id: request.id,
            message: 'Refund request submitted. The organizer will review within 24 hours.'
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
    }

    // ========================================================================
    // 9. MANUAL REVIEW NEEDED - Return Pending
    // ========================================================================
    
    logStep("Manual review required", { reason: autoApproveCheck?.reason });

    // TODO: Send notification to organizer (email or push)
    // await sendOrganizerNotification(order.event_id, request.id);

    return new Response(
      JSON.stringify({
        status: 'pending',
        request_id: request.id,
        message: 'Refund request submitted. The organizer will review and respond within 24 hours.',
        review_reason: autoApproveCheck?.reason
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ 
        status: 'error',
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

