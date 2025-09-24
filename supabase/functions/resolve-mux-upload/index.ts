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
    console.log("Starting resolve-mux-upload request");
    
    const authHeader = req.headers.get("Authorization") ?? "";
    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON, { 
      global: { headers: { Authorization: authHeader } } 
    });
    
    const { data: { user }, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !user) {
      console.error("Authentication failed:", userErr);
      return createErrorResponse("not_authenticated", 401);
    }

    const { upload_id } = await req.json();
    console.log("Resolving upload:", upload_id);
    
    if (!upload_id) {
      return createErrorResponse("missing upload_id", 400);
    }

    // Get upload status from Mux
    const auth = "Basic " + btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
    
    console.log("Checking Mux upload status");
    const muxRes = await fetch(`https://api.mux.com/video/v1/uploads/${upload_id}`, {
      method: "GET",
      headers: { 
        "authorization": auth, 
        "content-type": "application/json" 
      }
    });

    if (!muxRes.ok) {
      const txt = await muxRes.text();
      console.error("Mux upload status failed:", muxRes.status, txt);
      return createErrorResponse(`mux_upload_status_failed: ${txt}`, 502);
    }

    const { data: uploadData } = await muxRes.json();
    console.log("Upload status:", uploadData.status);

    if (uploadData.status !== "asset_created") {
      console.log("Upload still processing, status:", uploadData.status);
      return createResponse({
        status: uploadData.status,
        playback_id: null
      });
    }

    // Get asset details to get playback ID
    const assetId = uploadData.asset_id;
    console.log("Getting asset details for:", assetId);
    
    const assetRes = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, {
      method: "GET",
      headers: { 
        "authorization": auth, 
        "content-type": "application/json" 
      }
    });

    if (!assetRes.ok) {
      const txt = await assetRes.text();
      console.error("Mux asset fetch failed:", assetRes.status, txt);
      return createErrorResponse(`mux_asset_fetch_failed: ${txt}`, 502);
    }

    const { data: assetData } = await assetRes.json();
    const playbackId = assetData.playback_ids?.[0]?.id;
    
    if (!playbackId) {
      console.error("No playback ID found in asset data");
      return createErrorResponse("no_playback_id", 500);
    }

    console.log("Found playback ID:", playbackId);

    // Update the database record with the playback ID
    const sbSrv = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error: updateErr } = await sbSrv
      .from("event_share_assets")
      .update({
        mux_playback_id: playbackId,
        mux_asset_id: assetId
      })
      .eq("mux_upload_id", upload_id);

    if (updateErr) {
      console.error("Database update error:", updateErr);
      return createErrorResponse(updateErr.message, 400);
    }

    console.log("Successfully resolved upload to playback ID:", playbackId);

    return createResponse({
      status: "ready",
      playback_id: playbackId,
      asset_id: assetId
    });

  } catch (e) {
    console.error("Resolve Mux upload error:", e);
    console.error("Error stack:", (e as any)?.stack);
    const errorMessage = e instanceof Error ? e.message : "unknown_error";
    return createErrorResponse(errorMessage, 500);
  }
});