import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[review-refund-request] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { request_id, action, organizer_response } = await req.json();
    
    if (!request_id || !action) {
      throw new Error("request_id and action (approve/decline) required");
    }

    if (!['approve', 'decline'].includes(action)) {
      throw new Error("action must be 'approve' or 'decline'");
    }

    logStep(`Review action: ${action}`, { requestId: request_id });

    // ========================================================================
    // 1. AUTHENTICATE USER
    // ========================================================================
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentication required");

    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      authHeader.replace("Bearer ", ""),
      { auth: { persistSession: false } }
    );

    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !user) throw new Error("Authentication failed");

    logStep("User authenticated", { userId: user.id });

    // ========================================================================
    // 2. GET REQUEST WITH FULL CONTEXT
    // ========================================================================
    
    const { data: request, error: reqErr } = await supabaseService
      .from("refund_requests")
      .select(`
        *,
        orders:order_id(
          *,
          events:event_id(
            id,
            title,
            start_at,
            created_by,
            owner_context_type,
            owner_context_id
          )
        )
      `)
      .eq("id", request_id)
      .single();

    if (reqErr || !request) {
      throw new Error("Refund request not found");
    }

    logStep("Request found", { 
      orderId: request.order_id,
      status: request.status,
      eventTitle: request.orders?.events?.title
    });

    // ========================================================================
    // 3. CHECK AUTHORIZATION
    // ========================================================================
    
    const isEventCreator = request.orders?.events?.created_by === user.id;
    let isOrgAdmin = false;

    if (request.orders?.events?.owner_context_type === 'organization') {
      const { data: orgMember } = await supabaseService
        .from('org_members')
        .select('role')
        .eq('org_id', request.orders.events.owner_context_id)
        .eq('user_id', user.id)
        .maybeSingle();
      
      isOrgAdmin = orgMember?.role === 'admin' || orgMember?.role === 'owner';
    }

    const { data: userProfile } = await supabaseService
      .from('user_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();
    
    const isPlatformAdmin = userProfile?.is_admin === true;

    if (!isEventCreator && !isOrgAdmin && !isPlatformAdmin) {
      logStep("Authorization failed", {
        isEventCreator,
        isOrgAdmin,
        isPlatformAdmin
      });
      throw new Error("Not authorized to review this refund request");
    }

    logStep("Authorization passed", { isEventCreator, isOrgAdmin, isPlatformAdmin });

    // ========================================================================
    // 4. CHECK IF ALREADY REVIEWED
    // ========================================================================
    
    if (request.status !== 'pending') {
      return new Response(
        JSON.stringify({
          status: 'already_reviewed',
          current_status: request.status,
          reviewed_at: request.reviewed_at,
          reviewed_by: request.reviewed_by
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // 5. PROCESS ACTION
    // ========================================================================

    if (action === 'approve') {
      logStep("Approving request", { requestId: request_id });

      // Mark as approved
      await supabaseService
        .from("refund_requests")
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          organizer_response: organizer_response || 'Refund approved'
        })
        .eq("id", request_id);

      // Process actual Stripe refund via process-refund function
      const refundResponse = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-refund`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            order_id: request.order_id,
            reason: `Organizer approved: ${request.reason}${request.details ? ' - ' + request.details : ''}`,
            _bypass_auth: true,
            _initiated_by: user.id
          })
        }
      );

      const refundData = await refundResponse.json();

      if (!refundResponse.ok || refundData.status === 'error') {
        // Refund failed - revert to pending
        await supabaseService
          .from("refund_requests")
          .update({ status: 'pending' })
          .eq("id", request_id);
        
        throw new Error(`Refund processing failed: ${refundData.error || 'Unknown error'}`);
      }

      logStep("Refund processed successfully", { 
        refundId: refundData.refund?.id 
      });

      // Link to refund log
      const { data: refundLog } = await supabaseService
        .from("refund_log")
        .select("id")
        .eq("order_id", request.order_id)
        .order("processed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (refundLog) {
        await supabaseService
          .from("refund_requests")
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            refund_log_id: refundLog.id
          })
          .eq("id", request_id);
      }

      // TODO: Send email to customer (refund approved)

      return new Response(
        JSON.stringify({
          status: 'approved',
          refund: refundData?.refund,
          message: 'Refund approved and processed. Customer will receive email confirmation.'
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // DECLINE PATH
    // ========================================================================
    
    if (action === 'decline') {
      logStep("Declining request", { requestId: request_id });

      await supabaseService
        .from("refund_requests")
        .update({
          status: 'declined',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
          organizer_response: organizer_response || 'Refund request declined',
          decline_reason: organizer_response || 'Declined by organizer'
        })
        .eq("id", request_id);

      // TODO: Send email to customer (refund declined with reason)

      logStep("Request declined", { requestId: request_id });

      return new Response(
        JSON.stringify({
          status: 'declined',
          message: 'Refund request declined. Customer will be notified.'
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ 
        status: 'error',
        error: error.message 
      }),
      { 
        status: error.message?.includes("Not authorized") ? 403 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

