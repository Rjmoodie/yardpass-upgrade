import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Get pending push notifications (limit to 50 per run)
    const { data: queueItems, error: queueError } = await supabase
      .from("push_notification_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (queueError) {
      throw queueError;
    }

    if (!queueItems || queueItems.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending push notifications", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let successCount = 0;
    let failureCount = 0;

    // Process each queued notification
    for (const item of queueItems) {
      try {
        // Get user's device tokens
        const { data: devices, error: devicesError } = await supabase
          .from("user_devices")
          .select("push_token, platform")
          .eq("user_id", item.user_id)
          .eq("active", true)
          .not("push_token", "is", null);

        if (devicesError || !devices || devices.length === 0) {
          // No devices, mark as sent (user doesn't have push enabled)
          await supabase
            .from("push_notification_queue")
            .update({
              status: "sent",
              processed_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          continue;
        }

        // Call send-push-notification function
        const { error: pushError } = await supabase.functions.invoke("send-push-notification", {
          body: {
            user_id: item.user_id,
            title: item.title,
            body: item.body,
            data: item.data || {},
          },
        });

        if (pushError) {
          throw pushError;
        }

        // Mark as sent
        await supabase
          .from("push_notification_queue")
          .update({
            status: "sent",
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        successCount++;
      } catch (error) {
        console.error(`[process-push-queue] Error processing item ${item.id}:`, error);

        // Increment attempts
        const newAttempts = (item.attempts || 0) + 1;
        const shouldMarkFailed = newAttempts >= (item.max_attempts || 3);

        await supabase
          .from("push_notification_queue")
          .update({
            attempts: newAttempts,
            status: shouldMarkFailed ? "failed" : "pending",
            error_message: error instanceof Error ? error.message : String(error),
            processed_at: shouldMarkFailed ? new Date().toISOString() : null,
          })
          .eq("id", item.id);

        if (shouldMarkFailed) {
          failureCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: queueItems.length,
        successful: successCount,
        failed: failureCount,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[process-push-queue] Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

