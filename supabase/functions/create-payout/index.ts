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

    const { context_type, context_id, amount_cents } = await req.json();

    if (!context_type || !context_id || !amount_cents) {
      throw new Error("Missing required parameters");
    }

    // Initialize Supabase service client
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify user has permission to request payout for this context
    let hasPermission = false;
    if (context_type === 'individual' && context_id === userData.user.id) {
      hasPermission = true;
    } else if (context_type === 'organization') {
      // Check if user is admin/owner of the organization
      const { data: membership } = await supabaseService
        .from('organizations.org_memberships')
        .select('role')
        .eq('org_id', context_id)
        .eq('user_id', userData.user.id)
        .single();
      
      if (membership && ['owner', 'admin'].includes(membership.role)) {
        hasPermission = true;
      }
    }

    if (!hasPermission) {
      throw new Error("Unauthorized to request payout for this context");
    }

    // Get the payout account
    const { data: payoutAccount, error: accountError } = await supabaseService
      .from('payments.payout_accounts')
      .select('*')
      .eq('context_type', context_type)
      .eq('context_id', context_id)
      .single();

    if (accountError || !payoutAccount) {
      throw new Error("Payout account not found");
    }

    if (!payoutAccount.stripe_connect_id) {
      throw new Error("Stripe Connect account not set up");
    }

    if (!payoutAccount.charges_enabled || !payoutAccount.payouts_enabled || !payoutAccount.details_submitted) {
      throw new Error("Stripe Connect account not fully verified");
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check account balance
    const balance = await stripe.balance.retrieve({
      stripeAccount: payoutAccount.stripe_connect_id
    });

    const availableAmount = balance.available.reduce((total: number, b: any) => {
      if (b.currency === 'usd') return total + b.amount;
      return total;
    }, 0);

    if (amount_cents > availableAmount) {
      throw new Error(`Insufficient balance. Available: $${(availableAmount / 100).toFixed(2)}, Requested: $${(amount_cents / 100).toFixed(2)}`);
    }

    // Create payout
    const payout = await stripe.payouts.create({
      amount: amount_cents,
      currency: 'usd',
      description: `Payout requested via platform`,
      metadata: {
        context_type,
        context_id,
        requested_by: userData.user.id
      }
    }, {
      stripeAccount: payoutAccount.stripe_connect_id
    });

    return new Response(
      JSON.stringify({
        success: true,
        payout_id: payout.id,
        amount: payout.amount,
        status: payout.status,
        arrival_date: payout.arrival_date
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in create-payout:', error);
    return new Response(
      JSON.stringify({ error: (error as any)?.message || 'Unknown error' }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});