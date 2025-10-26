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

    // Authenticate user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw userError;
    if (!userData.user) throw new Error("User not authenticated");

    const { context_type, context_id } = await req.json();

    if (!context_type || !context_id) {
      throw new Error("Missing required parameters");
    }

    // Initialize Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify user has permission to view balance for this context
    console.log(`[get-stripe-balance] Checking permissions for user ${userData.user.id}, context_type: ${context_type}, context_id: ${context_id}`);
    
    let hasPermission = false;
    if (context_type === 'individual' && context_id === userData.user.id) {
      hasPermission = true;
      console.log('[get-stripe-balance] Permission granted: individual context matches user');
    } else if (context_type === 'organization') {
      // Check if user is member of the organization
      const { data: membership, error: membershipError } = await supabaseService
        .from('org_members')
        .select('role')
        .eq('org_id', context_id)
        .eq('user_id', userData.user.id)
        .single();
      
      console.log(`[get-stripe-balance] Membership query result:`, { membership, membershipError });
      
      if (membership && ['owner', 'admin', 'editor'].includes(membership.role)) {
        hasPermission = true;
        console.log(`[get-stripe-balance] Permission granted: user has role ${membership.role}`);
      }
    }

    if (!hasPermission) {
      console.error(`[get-stripe-balance] Permission denied for user ${userData.user.id}, context: ${context_type}/${context_id}`);
      throw new Error("Unauthorized to view balance for this context");
    }

    // Get the payout account
    const { data: payoutAccount, error: accountError } = await supabaseService
      .from('payout_accounts')
      .select('*')
      .eq('context_type', context_type)
      .eq('context_id', context_id)
      .single();

    if (accountError || !payoutAccount) {
      return new Response(
        JSON.stringify({
          available: 0,
          pending: 0,
          currency: 'usd',
          account_ready: false,
          error: 'Payout account not found'
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    if (!payoutAccount.stripe_connect_id) {
      return new Response(
        JSON.stringify({
          available: 0,
          pending: 0,
          currency: 'usd',
          account_ready: false,
          error: 'Stripe Connect account not set up'
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Get balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: payoutAccount.stripe_connect_id
    });

    const availableAmount = balance.available.reduce((total: number, b: any) => {
      if (b.currency === 'usd') return total + b.amount;
      return total;
    }, 0);

    const pendingAmount = balance.pending.reduce((total: number, b: any) => {
      if (b.currency === 'usd') return total + b.amount;
      return total;
    }, 0);

    const accountReady = payoutAccount.charges_enabled && 
                        payoutAccount.payouts_enabled && 
                        payoutAccount.details_submitted;

    return new Response(
      JSON.stringify({
        available: availableAmount,
        pending: pendingAmount,
        currency: 'usd',
        account_ready: accountReady,
        charges_enabled: payoutAccount.charges_enabled,
        payouts_enabled: payoutAccount.payouts_enabled,
        details_submitted: payoutAccount.details_submitted
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in get-stripe-balance:', error);
    return new Response(
      JSON.stringify({ 
        available: 0,
        pending: 0,
        currency: 'usd',
        account_ready: false,
        error: (error as any)?.message || 'Unknown error' 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});