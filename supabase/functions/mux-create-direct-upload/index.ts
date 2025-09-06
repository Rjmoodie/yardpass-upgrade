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

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON, { 
      global: { headers: { Authorization: authHeader } } 
    });
    
    const { data: { user }, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !user) {
      return createErrorResponse("not_authenticated", 401);
    }

    const { event_id, kind = "story_video", title, caption } = await req.json();
    if (!event_id) {
      return createErrorResponse("missing event_id", 400);
    }
    if (!["story_video","link_video"].includes(kind)) {
      return createErrorResponse("invalid kind", 400);
    }

    // Check if user can manage this event
    const { data: can } = await sbUser.rpc("is_event_manager", { p_event_id: event_id });
    if (!can) {
      return createErrorResponse("forbidden", 403);
    }

    // Create Mux Direct Upload
    const auth = "Basic " + btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
    const muxRes = await fetch("https://api.mux.com/video/v1/uploads", {
      method: "POST",
      headers: { 
        "authorization": auth, 
        "content-type": "application/json" 
      },
      body: JSON.stringify({
        cors_origin: "*",
        new_asset_settings: {
          playback_policy: ["public"],
          mp4_support: "standard"
        }
      })
    });

    if (!muxRes.ok) {
      const txt = await muxRes.text();
      console.error("Mux upload creation failed:", txt);
      return createErrorResponse(`mux_upload_create_failed: ${txt}`, 502);
    }

    const { data: upload } = await muxRes.json();

    // Save a placeholder row using service role
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

    console.log("Created direct upload:", upload.id, "for event:", event_id);

    return createResponse({
      upload_id: upload.id,
      upload_url: upload.url,
      asset_row_id: row.id
    }, 201);

  } catch (e) {
    console.error("Mux direct upload error:", e);
    return createErrorResponse(e?.message ?? "unknown_error", 500);
  }
});