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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    // Initialize Supabase client with service role for database writes
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user with anon key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw userError;
    if (!userData.user) throw new Error("User not authenticated");

    const { context_type, context_id, return_url, refresh_url } = await req.json();

    // Validate context
    if (context_type !== 'individual' && context_type !== 'organization') {
      throw new Error("Invalid context_type");
    }

    // Validate permissions based on context type
    if (context_type === 'individual') {
      if (context_id !== userData.user.id) {
        throw new Error("Unauthorized: context_id must match authenticated user for individual accounts");
      }
    } else if (context_type === 'organization') {
      // For organizations, verify user has admin/owner role
      const { data: membership, error: membershipError } = await supabaseService
        .from('organizations.org_memberships')
        .select('role')
        .eq('org_id', context_id)
        .eq('user_id', userData.user.id)
        .single();

      if (membershipError || !membership) {
        throw new Error("Unauthorized: not a member of this organization");
      }

      if (!['owner', 'admin'].includes(membership.role)) {
        throw new Error("Unauthorized: insufficient permissions for organization");
      }
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check if account already exists
    let { data: existingAccount } = await supabaseService
      .from('payments.payout_accounts')
      .select('*')
      .eq('context_type', context_type)
      .eq('context_id', context_id)
      .maybeSingle();

    let stripeAccountId: string;

    if (existingAccount?.stripe_connect_id) {
      stripeAccountId = existingAccount.stripe_connect_id;
    } else {
    // Check circuit breaker before creating account
      const correlationId = crypto.randomUUID();
      const { data: cb } = await supabaseService.rpc('check_circuit_breaker', { p_service_id: 'stripe_api' });
      if (!cb?.can_proceed) {
        return new Response(JSON.stringify({ 
          error: 'Stripe API temporarily unavailable',
          correlation_id: correlationId 
        }), { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Create new Stripe Connect account with resilience
      let account;
      try {
        account = await stripe.accounts.create({
          type: 'express',
          country: 'US', // Default to US, should be configurable
          email: userData.user.email,
        });

        // Success - close circuit breaker
        await supabaseService.rpc('update_circuit_breaker_state', { 
          p_service_id: 'stripe_api', 
          p_success: true 
        });

      } catch (stripeError) {
        // Open/increment circuit breaker
        await supabaseService.rpc('update_circuit_breaker_state', { 
          p_service_id: 'stripe_api', 
          p_success: false, 
          p_error_message: (stripeError as any)?.message || 'Unknown Stripe error'
        });
        throw stripeError;
      }

      stripeAccountId = account.id;

      // Store in database
      if (existingAccount) {
        await supabaseService
          .from('payments.payout_accounts')
          .update({
            stripe_connect_id: stripeAccountId,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
          })
          .eq('id', existingAccount.id);
      } else {
        await supabaseService
          .from('payments.payout_accounts')
          .insert({
            context_type,
            context_id,
            stripe_connect_id: stripeAccountId,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
          });
      }
    }

    // Create account link for onboarding with resilience
    let accountLink;
    try {
      accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        return_url: return_url || `${req.headers.get("origin")}/dashboard?tab=payouts`,
        refresh_url: refresh_url || `${req.headers.get("origin")}/dashboard?tab=payouts`,
        type: 'account_onboarding',
      });

      // Success - close circuit breaker
      await supabaseService.rpc('update_circuit_breaker_state', { 
        p_service_id: 'stripe_api', 
        p_success: true 
      });

    } catch (stripeError) {
      // Open/increment circuit breaker
      await supabaseService.rpc('update_circuit_breaker_state', { 
        p_service_id: 'stripe_api', 
        p_success: false, 
        p_error_message: (stripeError as any)?.message || 'Unknown Stripe error' 
      });
      throw stripeError;
    }

    return new Response(
      JSON.stringify({
        account_id: stripeAccountId,
        account_link_url: accountLink.url,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in create-stripe-connect:', error);
    return new Response(
      JSON.stringify({ error: (error as any)?.message || 'Unknown error' }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});