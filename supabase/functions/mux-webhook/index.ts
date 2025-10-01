import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, createResponse, createErrorResponse } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MUX_WEBHOOK_SECRET = Deno.env.get("MUX_WEBHOOK_SECRET");

async function verifyMuxSignature(req: Request, payload: string): Promise<boolean> {
  if (!MUX_WEBHOOK_SECRET) {
    console.warn("⚠️ MUX_WEBHOOK_SECRET not set - skipping signature verification");
    return true;
  }

  const signature = req.headers.get("Mux-Signature");
  if (!signature) {
    console.error("❌ No Mux-Signature header found");
    return false;
  }

  try {
    // Mux signature format: t=timestamp,v1=signature
    const parts = signature.split(",");
    const timestamp = parts.find(p => p.startsWith("t="))?.split("=")[1];
    const sig = parts.find(p => p.startsWith("v1="))?.split("=")[1];

    if (!timestamp || !sig) {
      console.error("❌ Invalid signature format");
      return false;
    }

    // Create expected signature: timestamp + "." + payload
    const signedPayload = `${timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(MUX_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const expectedSig = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedPayload)
    );
    
    const expectedHex = Array.from(new Uint8Array(expectedSig))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    const isValid = expectedHex === sig;
    if (!isValid) {
      console.error("❌ Signature verification failed");
    }
    
    return isValid;
  } catch (error) {
    console.error("❌ Signature verification error:", error);
    return false;
  }
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return createErrorResponse("Method not allowed", 405);
  }

  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    // Verify signature
    const isValid = await verifyMuxSignature(req, rawBody);
    if (!isValid) {
      return createErrorResponse("invalid_signature", 401);
    }
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