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
    const body = await safeJson(req);
    console.log('🔵 reactions-toggle received:', body);
    const { post_id, kind, action } = body;
    if (!post_id || kind !== "like") {
      console.error('❌ Invalid request:', { post_id, kind });
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
    console.log('🔍 Checking for existing like:', { post_id, user_id });
    const { data: existing, error: existErr } = await supabase
      .from("event_reactions")
      .select("*")
      .eq("post_id", post_id)
      .eq("user_id", user_id)
      .eq("kind", "like")
      .maybeSingle();
    
    if (existErr) {
      console.error('❌ Error checking existing like:', existErr);
      return json(400, { error: "check_failed", detail: existErr.message });
    }
    console.log('✅ Existing like check result:', { exists: !!existing });

    let isLiked: boolean;

    if (existing) {
      // UNLIKE - delete using composite key
      const { error: delErr } = await supabase
        .from("event_reactions")
        .delete()
        .eq("post_id", post_id)
        .eq("user_id", user_id)
        .eq("kind", "like");
      if (delErr) return json(403, { error: "forbidden_delete", detail: delErr.message });
      isLiked = false;
    } else {
      // LIKE (ignore duplicate under race)
      console.log('➕ Inserting new like');
      const { error: insErr } = await supabase
        .from("event_reactions")
        .insert({ post_id, user_id, kind: "like" });
      // If conflict (race), proceed — unique index protects us
      if (insErr && (insErr as any).code !== "23505") {
        console.error('❌ Error inserting like:', insErr);
        return json(400, { error: "insert_failed", detail: insErr.message });
      }
      console.log('✅ Like inserted successfully');
      isLiked = true;
    }

    // Get exact count in a single query
    const { count, error: cntErr } = await supabase
      .from("event_reactions")
      .select("*", { count: "exact", head: true })
      .eq("post_id", post_id)
      .eq("kind", "like");
    if (cntErr) return json(400, { error: "count_failed", detail: cntErr.message });

    console.log('✅ Returning success:', { isLiked, count });
    return json(200, { 
      post_id,
      liked: isLiked, 
      viewer_has_liked: isLiked,
      like_count: count ?? 0 
    });
  } catch (e: any) {
    console.error('❌ Unhandled error:', e);
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