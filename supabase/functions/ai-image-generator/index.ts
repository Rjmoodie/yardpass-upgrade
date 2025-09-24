// supabase/functions/ai-image-generator/index.ts
// Deno + Supabase Edge Function - Updated deployment
// Env vars required:
// - OPENAI_API_KEY
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - PUBLIC_EVENT_MEDIA_BUCKET (optional, defaults to "event-media")

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = Deno.env.get("PUBLIC_EVENT_MEDIA_BUCKET") || "event-media";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    if (!OPENAI_API_KEY) {
      return json({ error: "Missing OPENAI_API_KEY" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const {
      title,
      category,
      city,
      style = "vibrant poster",
      prompt = "",
      save_to_storage = true,
      user_id = "anonymous",
    } = body || {};

    const desc = [
      `Event poster`,
      title ? `Title: ${title}` : null,
      category ? `Category: ${category}` : null,
      city ? `City: ${city}` : null,
      `Style: ${style}`,
      prompt ? `Details: ${prompt}` : null,
      `Clean typography, centered composition, photo/illustration blend`,
    ].filter(Boolean).join(", ");

    // OpenAI Images API (gpt-image-1)
    const gen = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: desc,
        size: "1024x1024",
        n: 1,
        response_format: "b64_json",
      }),
    });

    if (!gen.ok) {
      const errText = await gen.text();
      return json({ error: `OpenAI error: ${errText}` }, 500);
    }

    const payload = await gen.json();
    const b64 = payload?.data?.[0]?.b64_json as string | undefined;
    if (!b64) return json({ error: "No image returned" }, 500);

    if (!save_to_storage) {
      return json({ image_url: `data:image/png;base64,${b64}` });
    }

    // Save PNG into storage and return public URL
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const key = `${user_id}/ai-cover-${Date.now()}.png`;
    const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(key, bytes, {
      contentType: "image/png",
      upsert: false,
    });
    if (uploadErr) return json({ error: uploadErr.message }, 500);

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(key);
    return json({ image_url: publicUrl });
  } catch (e: any) {
    console.error("[ai-image-generator] error:", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}