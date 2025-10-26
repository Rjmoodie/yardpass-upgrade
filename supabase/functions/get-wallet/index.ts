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
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    console.log(`[get-wallet] Fetching wallet for user ${user.id}`);

    // First, get the user's organization membership
    const { data: membership, error: membershipError } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (membershipError || !membership) {
      console.error(`[get-wallet] No active organization membership found for user ${user.id}`, membershipError);
      throw new Error("No active organization membership found");
    }

    const orgId = membership.org_id;
    console.log(`[get-wallet] Found organization ${orgId} for user ${user.id}`);

    // Fetch or create wallet for the organization
    let { data: wallet, error: fetchError } = await supabase
      .from("org_wallets")
      .select("*")
      .eq("org_id", orgId)
      .single();

    // If wallet doesn't exist, create it
    if (fetchError?.code === 'PGRST116') {
      console.log(`[get-wallet] Wallet not found, creating new wallet for org ${orgId}`);
      
      const { data: newWallet, error: createError } = await supabase
        .from("org_wallets")
        .insert({
          org_id: orgId,
          balance_credits: 0,
          low_balance_threshold: 1000,
          auto_reload_enabled: false,
          auto_reload_topup_credits: 5000,
          status: 'active'
        })
        .select()
        .single();

      if (createError) {
        console.error(`[get-wallet] Failed to create wallet:`, createError);
        throw new Error("Failed to create wallet");
      }

      wallet = newWallet;
    } else if (fetchError) {
      console.error(`[get-wallet] Failed to fetch wallet:`, fetchError);
      throw fetchError;
    }

    console.log(`[get-wallet] Wallet ID: ${wallet.id}`);

    // Fetch recent transactions (last 10)
    const { data: transactions, error: txError } = await supabase
      .from("org_wallet_transactions")
      .select("*")
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (txError) throw txError;

    return new Response(
      JSON.stringify({
        id: wallet.id,
        org_id: membership.org_id,
        balance_credits: wallet.balance_credits,
        usd_equiv: wallet.balance_credits / 100,
        low_balance_threshold: wallet.low_balance_threshold,
        auto_reload_enabled: wallet.auto_reload_enabled,
        auto_reload_topup_credits: wallet.auto_reload_topup_credits,
        status: wallet.status,
        recent_transactions: transactions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[get-wallet] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});