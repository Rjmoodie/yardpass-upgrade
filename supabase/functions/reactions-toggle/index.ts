import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const url = Deno.env.get("SUPABASE_URL")!;
const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { post_id, kind } = await safeJson(req);
    if (!post_id || kind !== "like") {
      return json(400, { error: "post_id and kind='like' required" });
    }

    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });

    // who is calling?
    const { data: userRes, error: uerr } = await supabase.auth.getUser();
    if (uerr || !userRes?.user?.id) return json(401, { error: "unauthorized" });
    const user_id = userRes.user.id;

    // do we already have a like?
    const { data: existing } = await supabase
      .from("event_reactions")
      .select("id")
      .eq("post_id", post_id)
      .eq("user_id", user_id)
      .eq("kind", "like")
      .maybeSingle();

    if (existing) {
      // UNLIKE
      const { error: delErr } = await supabase
        .from("event_reactions")
        .delete()
        .eq("id", existing.id);
      if (delErr) return json(403, { error: "forbidden_delete", detail: delErr.message });
    } else {
      // LIKE (ignore duplicate under race)
      const { error: insErr } = await supabase
        .from("event_reactions")
        .insert({ post_id, user_id, kind: "like" });
      // If conflict (race), proceed — unique index protects us
      if (insErr && (insErr as any).code !== "23505") {
        return json(400, { error: "insert_failed", detail: insErr.message });
      }
    }

    // exact count
    const { count, error: cntErr } = await supabase
      .from("event_reactions")
      .select("*", { count: "exact", head: true })
      .eq("post_id", post_id)
      .eq("kind", "like");
    if (cntErr) return json(400, { error: "count_failed", detail: cntErr.message });

    // current liked state
    const { data: nowLiked } = await supabase
      .from("event_reactions")
      .select("id")
      .eq("post_id", post_id)
      .eq("user_id", user_id)
      .eq("kind", "like")
      .maybeSingle();

    return json(200, { liked: Boolean(nowLiked), like_count: count ?? 0 });
  } catch (e: any) {
    console.error(e);
    return json(500, { error: e?.message ?? "error" });
  }
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 
      ...corsHeaders,
      "content-type": "application/json; charset=utf-8" 
    },
  });
}
async function safeJson(req: Request) {
  try { return await req.json(); } catch { return {}; }
}