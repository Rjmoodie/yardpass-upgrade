// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** ---------------------------
 *   CORS HELPER (inlined to avoid import issues)
 * ---------------------------- */
type WithCORSOpts = { allowOrigins?: string[] };

function withCORS(
  handler: (req: Request) => Promise<Response>,
  opts: WithCORSOpts = {},
) {
  return async (req: Request) => {
    const origin = req.headers.get("Origin") || "";
    
    // Determine which origin to allow
    let allowOrigin = "*";
    if (opts.allowOrigins?.length) {
      const isAllowed = opts.allowOrigins.some(allowed => {
        if (allowed === origin) return true;
        // Support wildcard patterns like *.liventix.com
        if (allowed.includes("*")) {
          const pattern = allowed.replace(/\./g, "\\.").replace(/\*/g, ".*");
          return new RegExp(`^${pattern}$`).test(origin);
        }
        return false;
      });
      
      allowOrigin = isAllowed ? origin : "*";
    }

    // Preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": allowOrigin,
          "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const res = await handler(req);
    const headers = new Headers(res.headers);
    headers.set("Access-Control-Allow-Origin", allowOrigin);
    headers.set("Vary", "Origin");
    return new Response(res.body, { status: res.status, headers });
  };
}

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");
const ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications";

interface PushNotificationRequest {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  sound?: string;
  priority?: "normal" | "high";
  android_channel_id?: string; // For Android notifications
}

interface OneSignalResponse {
  id?: string;
  recipients?: number;
  errors?: {
    invalid_player_ids?: string[];
    [key: string]: any;
  };
}

const handler = async (req: Request): Promise<Response> => {
  try {
    // Validate environment variables
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error("Missing OneSignal configuration");
      return new Response(
        JSON.stringify({ error: "Push notification service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const payload: PushNotificationRequest = await req.json();
    const { user_id, title, body, data, badge, sound, priority, android_channel_id } = payload;

    // Validate required fields
    if (!user_id || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id, title, body" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Supabase configuration missing" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // ========================================================================
    // SECURITY: Validate request authorization
    // ========================================================================
    // Option A: Check if called with SERVICE_ROLE (for triggers/internal calls)
    const authHeader = req.headers.get("Authorization");
    const isServiceRoleCall = authHeader?.includes("service_role") || authHeader?.includes(supabaseServiceKey);
    
    if (!isServiceRoleCall) {
      // Option B: Require user authentication and validate user_id matches token
      if (!authHeader || !supabaseAnonKey) {
        return new Response(
          JSON.stringify({ error: "Authorization required" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      // Validate user authentication
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid authentication" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      // Validate user_id matches authenticated user
      if (user.id !== user_id) {
        return new Response(
          JSON.stringify({ error: "Forbidden: user_id does not match authenticated user" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Use service role client for database operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get device tokens for user (iOS and Android)
    const { data: devices, error: devicesError } = await supabase
      .from("user_devices")
      .select("push_token, platform, active")
      .eq("user_id", user_id)
      .in("platform", ["ios", "android"])
      .eq("active", true)
      .not("push_token", "is", null);

    if (devicesError) {
      console.error("Error fetching devices:", devicesError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch device tokens" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!devices || devices.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No active devices found for user",
          user_id,
          devices_count: 0
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract push tokens
    const pushTokens = devices.map((d) => d.push_token).filter(Boolean) as string[];

    if (pushTokens.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid push tokens found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Separate iOS and Android tokens
    const iosDevices = devices.filter(d => d.platform === "ios");
    const androidDevices = devices.filter(d => d.platform === "android");
    const iosTokens = iosDevices.map(d => d.push_token).filter(Boolean) as string[];
    const androidTokens = androidDevices.map(d => d.push_token).filter(Boolean) as string[];

    // Build OneSignal notification payload
    // OneSignal can send to both iOS and Android in one request
    const oneSignalPayload: Record<string, any> = {
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: pushTokens, // All tokens (iOS + Android)
      headings: { en: title },
      contents: { en: body },
      data: data || {},
      mutable_content: true, // ✅ Enable rich notifications, images, actions
      content_available: true, // Enable background data updates
      priority: priority === "high" ? 10 : 5, // OneSignal uses 10 for high, 5 for normal
    };

    // iOS-specific settings
    if (iosTokens.length > 0) {
      oneSignalPayload.ios_badgeType = badge !== undefined ? "SetTo" : "Increase";
      if (badge !== undefined) {
        oneSignalPayload.ios_badgeCount = badge;
      }
      if (sound) {
        oneSignalPayload.ios_sound = sound;
      }
    }

    // Android-specific settings
    if (androidTokens.length > 0) {
      if (android_channel_id) {
        oneSignalPayload.android_channel_id = android_channel_id;
      }
      if (sound) {
        oneSignalPayload.android_sound = sound;
      }
    }

    // Send notification via OneSignal API
    console.log(`Sending push notification to ${pushTokens.length} device(s) for user ${user_id}`);
    
    const oneSignalResponse = await fetch(ONESIGNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(oneSignalPayload),
    });

    const result: OneSignalResponse = await oneSignalResponse.json();

    if (!oneSignalResponse.ok) {
      console.error("OneSignal API error:", result);
      const errorMessage = result.errors
        ? Object.values(result.errors).flat().join(", ")
        : "Unknown OneSignal error";

      return new Response(
        JSON.stringify({ 
          error: `OneSignal error: ${errorMessage}`,
          oneSignalResponse: result
        }),
        { status: oneSignalResponse.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle invalid tokens (410 Unregistered)
    if (result.errors?.invalid_player_ids?.length) {
      const invalidTokens = result.errors.invalid_player_ids;
      console.log(`Marking ${invalidTokens.length} invalid token(s) as inactive`);

      // Mark invalid tokens as inactive
      const { error: updateError } = await supabase
        .from("user_devices")
        .update({ 
          active: false, 
          last_seen_at: new Date().toISOString() 
        })
        .in("push_token", invalidTokens);

      if (updateError) {
        console.error("Error updating invalid tokens:", updateError);
      }
    }

    // Log successful delivery
    const sentCount = result.recipients || pushTokens.length;
    const notificationId = result.id || null;

    // ✅ Delivery logging (graceful if table doesn't exist)
    try {
      await supabase.from("notification_logs").insert({
        user_id,
        title,
        body,
        data: data || {},
        result_id: notificationId,
        sent_count: sentCount,
        total_devices: pushTokens.length,
        invalid_tokens_removed: result.errors?.invalid_player_ids?.length || 0,
        platform_breakdown: {
          ios: iosTokens.length,
          android: androidTokens.length,
        },
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      // Gracefully handle if notification_logs table doesn't exist
      console.warn("Could not log notification delivery (table may not exist):", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        notification_id: notificationId,
        sent: sentCount,
        total_devices: pushTokens.length,
        platform_breakdown: {
          ios: iosTokens.length,
          android: androidTokens.length,
        },
        invalid_tokens_removed: result.errors?.invalid_player_ids?.length || 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Push notification error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

// Export handler with CORS support (allow all origins for native apps)
Deno.serve(withCORS(handler, { allowOrigins: ["*"] }));

