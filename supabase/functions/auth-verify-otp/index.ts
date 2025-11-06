// supabase/functions/auth-verify-otp/index.ts
// Verify auth OTP and create session

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

const hashOtp = async (otp: string, email: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp + email.toLowerCase().trim());
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[auth-verify-otp] Missing Supabase env vars");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { email, otp } = await req.json().catch(() => ({} as any));

    if (!email || typeof email !== "string" || !otp || typeof otp !== "string") {
      return json({ error: "Email and OTP are required" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const otpHash = await hashOtp(otp, normalizedEmail);

    console.log(`[auth-verify-otp] Verifying OTP for ${normalizedEmail}`);

    // Find valid OTP in guest_otp_codes table
    const { data: otpRecord, error: otpError } = await supabase
      .from("guest_otp_codes")
      .select("*")
      .eq("contact", normalizedEmail)
      .eq("method", "email")
      .eq("otp_hash", otpHash)
      .is("event_id", null) // Only auth OTPs (event_id is NULL)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError || !otpRecord) {
      console.error("[auth-verify-otp] Invalid or expired OTP");
      return json({ error: "Invalid or expired code" }, { status: 401 });
    }

    console.log(`[auth-verify-otp] OTP valid`);

    // Get user_id by email using RPC (bypasses listUsers pagination)
    // @ts-ignore - Custom RPC
    const { data: userId, error: rpcErr } = await supabase.rpc('get_user_id_by_email', {
      p_email: normalizedEmail
    });

    console.log("[auth-verify-otp] RPC result:", { userId, rpcErr, hasError: !!rpcErr });

    if (rpcErr) {
      console.error("[auth-verify-otp] RPC error:", JSON.stringify(rpcErr));
      return json({ error: "Failed to look up user" }, { status: 500 });
    }

    if (!userId) {
      console.error("[auth-verify-otp] No user found for email");
      return json({ error: "User not found" }, { status: 404 });
    }
    
    console.log(`[auth-verify-otp] Found user ID: ${userId}`);

    // Generate recovery link and exchange the hashed_token for session tokens
    console.log(`[auth-verify-otp] Creating session for user: ${normalizedEmail}`);
    
    try {
      // Step 1: Generate a recovery link (this gives us a hashed_token)
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email: normalizedEmail,
      });

      console.log(`[auth-verify-otp] generateLink response:`, {
        hasData: !!linkData,
        hasProperties: !!linkData?.properties,
        hasUser: !!linkData?.user,
        error: linkError,
      });

      if (linkError || !linkData?.properties?.hashed_token) {
        console.error("[auth-verify-otp] Failed to generate recovery link:", linkError);
        return json({ error: "Failed to create session" }, { status: 500 });
      }

      const hashedToken = linkData.properties.hashed_token;
      console.log(`[auth-verify-otp] Got hashed token, exchanging for session...`);

      // Step 2: Exchange the hashed_token for session tokens by verifying it
      const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: hashedToken,
        type: 'recovery',
      });

      console.log(`[auth-verify-otp] verifyOtp (token_hash) response:`, {
        hasData: !!sessionData,
        hasSession: !!sessionData?.session,
        hasUser: !!sessionData?.user,
        error: verifyError,
      });

      if (verifyError || !sessionData?.session) {
        console.error("[auth-verify-otp] Failed to verify token:", verifyError);
        return json({ error: "Failed to create session" }, { status: 500 });
      }

      // Delete used OTP from our custom table (one-time use)
      await supabase.from("guest_otp_codes").delete().eq("id", otpRecord.id);

      console.log(`[auth-verify-otp] Session created successfully for ${normalizedEmail}`);

      return json(
        {
          success: true,
          access_token: sessionData.session.access_token,
          refresh_token: sessionData.session.refresh_token,
          user: sessionData.user,
        },
        { status: 200 }
      );
    } catch (sessionError) {
      console.error("[auth-verify-otp] Exception during session creation:", sessionError);
      return json({ error: "Session creation failed" }, { status: 500 });
    }
  } catch (error) {
    console.error("[auth-verify-otp] Error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
});
