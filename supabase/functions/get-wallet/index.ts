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

    // Ensure wallet exists (using authenticated user's RPC)
    const { data: walletId, error: walletError } = await supabase.rpc("ensure_wallet_exists_for_auth_user");

    if (walletError) {
      console.error(`[get-wallet] Failed to ensure wallet:`, walletError);
      throw new Error("Failed to initialize wallet");
    }

    console.log(`[get-wallet] Wallet ID: ${walletId}`);

    // Fetch wallet
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (walletError) throw walletError;

    // Fetch recent transactions (last 10)
    const { data: transactions, error: txError } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (txError) throw txError;

    const usdEquiv = (wallet.balance_credits / 100).toFixed(2);

    return new Response(
      JSON.stringify({
        balance_credits: wallet.balance_credits,
        usd_equiv: `$${usdEquiv}`,
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