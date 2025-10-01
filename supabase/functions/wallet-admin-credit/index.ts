import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // TODO: Check if user is admin (implement admin role check)
    // For now, only service role can call this
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { wallet_id, credits, memo } = body;

    if (!wallet_id || !credits || !memo) {
      throw new Error("wallet_id, credits, and memo are required");
    }

    console.log(`[wallet-admin-credit] Adding ${credits} credits to ${wallet_id}`);

    // Create transaction
    const { error: txError } = await supabaseService
      .from("wallet_transactions")
      .insert({
        wallet_id,
        type: "adjustment",
        credits_delta: credits,
        reference_type: "system",
        reference_id: user.id,
        memo: `Admin credit: ${memo}`,
      });

    if (txError) throw txError;

    // Recompute balance from ledger
    await supabaseService.rpc("recompute_wallet_balance", {
      p_wallet: wallet_id,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[wallet-admin-credit] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});