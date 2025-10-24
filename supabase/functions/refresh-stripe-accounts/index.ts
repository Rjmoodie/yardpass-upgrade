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
    // Initialize Supabase with service role for database updates
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Get all payout accounts with Stripe Connect IDs
    const { data: accounts, error } = await supabaseService
      .from('payout_accounts')
      .select('*')
      .not('stripe_connect_id', 'is', null);

    if (error) throw error;

    const updates = [];

    for (const account of accounts || []) {
      try {
        // Fetch latest account info from Stripe
        const stripeAccount = await stripe.accounts.retrieve(account.stripe_connect_id);
        
        // Update database with latest status
        const { error: updateError } = await supabaseService
          .from('payout_accounts')
          .update({
            charges_enabled: stripeAccount.charges_enabled,
            payouts_enabled: stripeAccount.payouts_enabled,
            details_submitted: stripeAccount.details_submitted,
          })
          .eq('id', account.id);

        if (updateError) {
          console.error(`Failed to update account ${account.id}:`, updateError);
        } else {
          updates.push({
            account_id: account.id,
            stripe_account_id: account.stripe_connect_id,
            charges_enabled: stripeAccount.charges_enabled,
            payouts_enabled: stripeAccount.payouts_enabled,
            details_submitted: stripeAccount.details_submitted,
          });
        }
      } catch (stripeError) {
        console.error(`Failed to fetch Stripe account ${account.stripe_connect_id}:`, stripeError);
      }
    }

    return new Response(
      JSON.stringify({
        updated_accounts: updates.length,
        updates: updates,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in refresh-stripe-accounts:', error);
    return new Response(
      JSON.stringify({ error: (error as any)?.message || 'Unknown error' }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});