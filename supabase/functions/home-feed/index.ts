// Deno Deploy / Supabase Edge Function
// GET or POST supported
// Query/body params:
//   user_id?: string
//   limit?: number (default 40, clamped to 1-100)
//   offset?: number (default 0, clamped to 0-10000)
//   mode?: 'smart' | 'basic' (default 'smart', falls back to 'basic' if RPC missing)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withCORS } from "../_shared/cors.ts";

const DEFAULT_LIMIT = 40;
const ALLOWED_ORIGINS = ["*"]; // TODO: tighten to your real origins when ready

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

export const handler = withCORS(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const isGet = req.method === "GET";

    // read params (GET -> query, POST -> json body)
    const q = isGet ? Object.fromEntries(url.searchParams.entries()) : await safeJson(req);

    const user_id = str(q.user_id);
    // Clamp inputs to prevent abuse
    const limit = Math.max(1, Math.min(num(q.limit, DEFAULT_LIMIT), 100));
    const offset = Math.max(0, Math.min(num(q.offset, 0), 10_000));
    const modeRaw = (q.mode ?? "").toString().toLowerCase();
    const mode: "smart" | "basic" = modeRaw === "basic" ? "basic" : "smart";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }
    });

    // Get current user for liked state
    const { data: { user } } = await supabase.auth.getUser();

    // 1) Fetch ranked items using the unified RPC or fallback
    let ranked:
      | { item_type: "event" | "post"; item_id: string; event_id: string; sort_ts?: string; score?: number }[]
      | null = null;

    if (mode === "smart") {
      const { data, error } = await supabase.rpc("get_home_feed_ranked", {
        p_user_id: user?.id ?? user_id ?? null,
        p_limit: limit,
        p_offset: offset,
      });

      // Only use ranked data if RPC succeeded and returned data
      if (!error && data && data.length > 0) {
        ranked = data;
      } else if (error) {
        console.warn("get_home_feed_ranked error => falling back to basic:", error.message);
      }
    }

    // Fallback: public upcoming events
    if (!ranked) {
      const { data: recentEvents, error } = await supabase
        .from("events")
        .select("id")
        .eq("visibility", "public")
        .gte("start_at", new Date().toISOString())
        .order("start_at", { ascending: true })
        .limit(limit);
      
      if (error) throw error;
      ranked = (recentEvents ?? []).map(e => ({
        item_type: "event" as const,
        item_id: e.id,
        event_id: e.id,
        sort_ts: new Date().toISOString(),
        score: 0.1
      }));
    }

    // 2) expand (events, posts, authors) in batched queries
    const eventIds = dedupe(ranked.map(r => r.event_id));
    const postIds = ranked.filter(r => r.item_type === "post").map(r => r.item_id);

    const [{ data: events }, postsRes] = await Promise.all([
      supabase
        .from("events")
        .select(`
          id, title, description, cover_image_url, start_at, venue, city, created_by,
          owner_context_type, owner_context_id,
          user_profiles!created_by(display_name),
          organizations!owner_context_id(name)
        `)
        .in("id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"]),
      
      postIds.length 
        ? supabase
            .from("event_posts")
            .select("id, event_id, text, media_urls, like_count, comment_count, author_user_id")
            .in("id", postIds)
        : Promise.resolve({ data: [], error: null })
    ]);

    const posts = postsRes?.data ?? [];

    // Get viewer's like states for posts if user is authenticated (with RLS tolerance)
    const { data: viewerLikes = [] } = user && postIds.length
      ? await supabase
          .from("event_reactions")
          .select("post_id")
          .eq("user_id", user.id)
          .eq("kind", "like")
          .in("post_id", postIds)
          .throwOnError(false)
      : { data: [] as any[] };

    const likedPostIds = new Set((viewerLikes || []).map(like => like.post_id));

    const authorIds = dedupe(posts.map(p => p.author_user_id).filter(Boolean));
    const { data: profiles } = authorIds.length
      ? await supabase
          .from("user_profiles")
          .select("user_id, display_name")
          .in("user_id", authorIds)
      : { data: [] };

    // 3) maps for quick expansion
    const eMap = new Map(events?.map(e => [e.id, e]) ?? []);
    const pMap = new Map(posts?.map(p => [p.id, p]) ?? []);
    const profMap = new Map(profiles?.map(p => [p.user_id, p]) ?? []);

    // 4) project to the exact shape the UI expects
    const items = ranked.map(row => {
      const ev = eMap.get(row.event_id);
      if (!ev) return null; // Drop orphan rows safely

      if (row.item_type === "event") {
        // Determine organizer name and ID based on ownership context
        const organizerName = ev?.owner_context_type === "organization" 
          ? ev?.organizations?.name 
          : ev?.user_profiles?.display_name;
        const organizerId = ev?.owner_context_type === "organization" 
          ? ev?.owner_context_id 
          : ev?.created_by;

        return {
          item_type: "event",
          item_id: row.item_id,
          event_id: row.event_id,
          event_title: ev?.title ?? "Event",
          event_description: ev?.description ?? "",
          event_cover_image: ev?.cover_image_url ?? null,
          event_starts_at: ev?.start_at ?? null,
          event_location: [ev?.venue, ev?.city].filter(Boolean).join(", ") || null,
          event_organizer: organizerName ?? "Organizer",
          event_organizer_id: organizerId ?? null,
          event_owner_context_type: ev?.owner_context_type ?? null
        };
      } else if (row.item_type === "post") {
        // Handle post items
        const po = pMap.get(row.item_id);
        if (!po) return null; // Drop posts we couldn't fetch

        const author = po?.author_user_id ? profMap.get(po.author_user_id) : null;
        const organizerName = ev?.owner_context_type === "organization" 
          ? ev?.organizations?.name ?? "Organization" 
          : ev?.user_profiles?.display_name ?? "Organizer";
        const organizerId = ev?.owner_context_type === "organization" 
          ? ev?.owner_context_id ?? "" 
          : ev?.created_by ?? "";

        return {
          item_type: "post",
          item_id: row.item_id,
          event_id: row.event_id,
          event_title: ev?.title ?? "Event",
          event_description: ev?.description ?? "",
          event_starts_at: ev?.start_at ?? null,
          event_cover_image: ev?.cover_image_url ?? "",
          event_organizer: organizerName,
          event_organizer_id: organizerId,
          event_owner_context_type: ev?.owner_context_type ?? "individual",
          event_location: [ev?.venue, ev?.city].filter(Boolean).join(", ") || "TBA",
          media_urls: po?.media_urls ?? [],
          content: po?.text ?? "",
          like_count: po?.like_count ?? 0,
          comment_count: po?.comment_count ?? 0,
          viewer_has_liked: likedPostIds.has(row.item_id),
          author_user_id: po?.author_user_id ?? null,
          author_name: author?.display_name ?? null
        };
      }
      return null;
    }).filter(Boolean);

    // 5) cache hints and response
    const usedMode = ranked ? "smart" : "basic";
    return json(200, { items, mode: usedMode }, {
      "Cache-Control": "private, max-age=20"
    });

  } catch (err) {
    console.error("home-feed error:", err);
    return json(500, { error: err?.message ?? "Internal error" });
  }
}, { allowOrigins: ALLOWED_ORIGINS });

/* ---------------- helpers ---------------- */

function json(status: number, body: any, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function str(x: any): string | undefined {
  if (typeof x === "string" && x.trim()) return x.trim();
  return undefined;
}

function num(x: any, def: number): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function dedupe(arr: any[]): any[] {
  return Array.from(new Set(arr));
}

Deno.serve(handler);