import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MUX_WEBHOOK_SECRET = Deno.env.get("MUX_WEBHOOK_SECRET");

function verifyMuxSig(): boolean {
  if (!MUX_WEBHOOK_SECRET) return true;
  // Add real HMAC verification here per Mux docs if needed
  return true;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  try {
    if (!verifyMuxSig()) {
      return createErrorResponse("invalid_signature", 401);
    }

    const payload = await req.json();
    const type = payload?.type as string;
    const data = payload?.data ?? {};
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    console.log("Mux webhook received:", type, "for asset:", data?.id);

    // Link upload to asset
    if (type === "video.upload.asset_created") {
      const uploadId = data?.id;
      const assetId = payload?.data?.asset_id;
      if (uploadId && assetId) {
        const { error } = await sb.from("event_share_assets")
          .update({ mux_asset_id: assetId })
          .eq("mux_upload_id", uploadId);
        
        if (error) {
          console.error("Failed to link upload to asset:", error);
        } else {
          console.log("Linked upload", uploadId, "to asset", assetId);
        }
      }
    }

    // Asset is ready - get playback id and poster
    if (type === "video.asset.ready") {
      const assetId = data?.id;
      const playbackIds: Array<{ id: string; policy: string }> = data?.playback_ids ?? [];
      const pb = playbackIds.find(p => p.policy === "public")?.id ?? playbackIds[0]?.id ?? null;
      const poster = pb ? `https://image.mux.com/${pb}/thumbnail.jpg?time=1` : null;

      if (assetId && pb) {
        const { error } = await sb.from("event_share_assets")
          .update({
            mux_playback_id: pb,
            poster_url: poster,
            duration_seconds: Math.round(data?.duration ?? 0),
            width: data?.max_stored_resolution?.width ?? null,
            height: data?.max_stored_resolution?.height ?? null
          })
          .eq("mux_asset_id", assetId);

        if (error) {
          console.error("Failed to update asset with playback info:", error);
        } else {
          console.log("Updated asset", assetId, "with playback id", pb);
        }
      }
    }

    return createResponse({ ok: true });

  } catch (e) {
    console.error("Mux webhook error:", e);
    return createErrorResponse((e as any)?.message ?? "unknown_error", 500);
  }
});