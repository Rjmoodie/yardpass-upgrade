import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-USER-TICKETS] ${step}${detailsStr}`);
};

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    logStep("Function started");

    // Create Supabase client using the anon key for user authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Fetch user's tickets with event and tier details
    const { data: tickets, error: ticketsError } = await supabaseClient
      .from('tickets')
      .select(`
        *,
        events (
          id,
          title,
          start_at,
          end_at,
          venue,
          city,
          address,
          cover_image_url
        ),
        ticket_tiers (
          name,
          badge_label,
          price_cents
        ),
        orders (
          total_cents,
          created_at
        )
      `)
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false });

    if (ticketsError) throw new Error(`Tickets fetch failed: ${ticketsError.message}`);
    logStep("Tickets fetched", { count: tickets?.length || 0 });

    return createResponse({ 
      tickets: tickets || [],
      count: tickets?.length || 0
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in get-user-tickets", { message: errorMessage });
    return createErrorResponse(errorMessage);
  }
});