import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MUX_TOKEN_ID = Deno.env.get("MUX_TOKEN_ID")!;
const MUX_TOKEN_SECRET = Deno.env.get("MUX_TOKEN_SECRET")!;

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  // Check for required environment variables
  if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
    console.error("Missing Mux credentials");
    return createErrorResponse("Missing Mux configuration", 500);
  }

  try {
    console.log("Starting Mux direct upload request");
    
    const authHeader = req.headers.get("Authorization") ?? "";
    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON, { 
      global: { headers: { Authorization: authHeader } } 
    });
    
    const { data: { user }, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !user) {
      console.error("Authentication failed:", userErr);
      return createErrorResponse("not_authenticated", 401);
    }

    console.log("User authenticated:", user.id);

    const { event_id, kind = "story_video", title, caption } = await req.json();
    console.log("Request data:", { event_id, kind, title, caption });
    
    if (!event_id) {
      return createErrorResponse("missing event_id", 400);
    }
    if (!["story_video","link_video"].includes(kind)) {
      return createErrorResponse("invalid kind", 400);
    }

    // Check if user can post to this event (includes ticket holders)
    console.log("Checking user permissions for event:", event_id);
    const { data: can } = await sbUser.rpc("can_current_user_post", { p_event_id: event_id });
    console.log("User can post:", can);
    
    if (!can) {
      return createErrorResponse("forbidden", 403);
    }

    // Create Mux Direct Upload
    console.log("Creating Mux direct upload");
    const auth = "Basic " + btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
    
    const muxPayload = {
      cors_origin: "*",
      new_asset_settings: {
        playback_policy: ["public"],
        mp4_support: "standard"
      }
    };
    
    console.log("Making request to Mux API");
    const muxRes = await fetch("https://api.mux.com/video/v1/uploads", {
      method: "POST",
      headers: { 
        "authorization": auth, 
        "content-type": "application/json" 
      },
      body: JSON.stringify(muxPayload)
    });

    console.log("Mux API response status:", muxRes.status);
    
    if (!muxRes.ok) {
      const txt = await muxRes.text();
      console.error("Mux upload creation failed:", muxRes.status, txt);
      return createErrorResponse(`mux_upload_create_failed: ${txt}`, 502);
    }

    const { data: upload } = await muxRes.json();
    console.log("Mux upload created:", upload.id);

    // Save a placeholder row using service role
    console.log("Saving to database");
    const sbSrv = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: row, error: insErr } = await sbSrv
      .from("event_share_assets")
      .insert({
        created_by: user.id,
        event_id,
        kind,
        title: title ?? null,
        caption: caption ?? null,
        mux_upload_id: upload.id,
        active: true
      })
      .select("id, event_id, kind, mux_upload_id")
      .single();

    if (insErr) {
      console.error("Database insert error:", insErr);
      return createErrorResponse(insErr.message, 400);
    }

    console.log("Successfully created direct upload:", upload.id, "for event:", event_id);

    return createResponse({
      upload_id: upload.id,
      upload_url: upload.url,
      asset_row_id: row.id
    }, 201);

  } catch (e) {
    console.error("Mux direct upload error:", e);
    console.error("Error stack:", e?.stack);
    const errorMessage = e instanceof Error ? e.message : "unknown_error";
    return createErrorResponse(errorMessage, 500);
  }
});