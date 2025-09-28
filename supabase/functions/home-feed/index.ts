// Deno Deploy / Supabase Edge Function
// GET or POST supported
// Query/body params:
//   user_id?: string
//   limit?: number (default 40)
//   offset?: number (default 0)
//   mode?: 'smart' | 'basic' (default 'smart', falls back to 'basic' if RPC missing)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withCORS } from "../_shared/cors.ts";
import type { FeedItem } from "./types.ts";

const DEFAULT_LIMIT = 40;
const ALLOWED_ORIGINS = ["*"]; // tighten if you want

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

export const handler = withCORS(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const isGet = req.method === "GET";

    // read params (GET -> query, POST -> json body)
    const q = isGet ? Object.fromEntries(url.searchParams.entries()) : await safeJson(req);

    const user_id   = str(q.user_id);
    const limit     = num(q.limit, DEFAULT_LIMIT);
    const offset    = num(q.offset, 0);
    const modeRaw   = (q.mode ?? "").toString().toLowerCase();
    const mode: "smart" | "basic" = modeRaw === "basic" ? "basic" : "smart";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }
    });

    // 1) fetch ranked IDs (smart or basic)
    let ranked:
      | { item_type: "event" | "post"; item_id: string; event_id: string; score?: number }[]
      | null = null;

    if (mode === "smart") {
      const { data, error } = await supabase.rpc("get_home_feed_ids", {
        p_user: user_id ?? null,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) {
        // If smart RPC missing, fall back to basic
        console.warn("get_home_feed_ids error => falling back to basic:", error.message);
      } else {
        ranked = (data ?? []) as any[];
      }
    }

    if (!ranked) {
      // Basic fallback (should return the already-expanded items if your legacy RPC did so;
      // if yours returns IDs instead, we'll expand below just the same)
      const { data, error } = await supabase.rpc("get_home_feed", {
        p_user: user_id ?? null,
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw error;
      // If your legacy RPC already returns the full shape, we can return early.
      // Heuristic: if it has event_title for the first row, assume expanded.
      if (Array.isArray(data) && data.length && "event_title" in data[0]) {
        return json(200, { items: data, mode: "basic" });
      }
      ranked = (data ?? []) as any[];
    }

    // 2) expand (events, posts, authors) in batched queries
    const eventIds = dedupe(ranked.map(r => r.event_id));
    const postIds  = ranked.filter(r => r.item_type === "post").map(r => r.item_id);

    const [{ data: events }, postsRes] = await Promise.all([
      supabase
        .from("events")
        .select("id, title, cover_image_url, start_at, venue, city")
        .in("id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"]),
      postIds.length
        ? supabase
            .from("event_posts")
            .select("id, event_id, media_urls, like_count, comment_count, author_user_id")
            .in("id", postIds)
        : Promise.resolve({ data: [] as any[], error: null }),
    ]);

    const posts = postsRes?.data ?? [];

    const authorIds = dedupe(posts.map((p: any) => p.author_user_id).filter(Boolean));
    const { data: profiles } = authorIds.length
      ? await supabase
          .from("user_profiles")
          .select("user_id, display_name")
          .in("user_id", authorIds)
      : { data: [] as any[] };

    // 3) maps for quick expansion
    const eMap = new Map(events?.map((e: any) => [e.id, e]) ?? []);
    const pMap = new Map(posts?.map((p: any) => [p.id, p]) ?? []);
    const profMap = new Map(profiles?.map((p: any) => [p.user_id, p]) ?? []);

    // 4) project to the exact shape the UI expects
    const items: FeedItem[] = ranked.map((row) => {
      const ev = eMap.get(row.event_id);
      if (row.item_type === "event") {
        return {
          item_type: "event",
          item_id: row.item_id,
          event_id: row.event_id,
          event_title: ev?.title ?? "Event",
          event_cover_image: ev?.cover_image_url ?? null,
          event_starts_at: ev?.start_at ?? null,
          event_location: [ev?.venue, ev?.city].filter(Boolean).join(", ") || null,
        };
      } else {
        const po = pMap.get(row.item_id);
        const author = po?.author_user_id ? profMap.get(po.author_user_id) : null;
        return {
          item_type: "post",
          item_id: row.item_id,
          event_id: row.event_id,
          event_title: ev?.title ?? "Event",
          media_urls: po?.media_urls ?? [],
          like_count: po?.like_count ?? 0,
          comment_count: po?.comment_count ?? 0,
          author_user_id: po?.author_user_id ?? null,
          author_name: author?.display_name ?? null,
        };
      }
    });

    // 5) cache hints (optional; tweak as you like)
    return json(200, { items, mode: ranked ? "smart" : "basic" }, {
      "Cache-Control": "private, max-age=20", // short since feed is dynamic
    });

  } catch (err: any) {
    console.error("home-feed error:", err);
    return json(500, { error: err?.message ?? "Internal error" });
  }
}, { allowOrigins: ALLOWED_ORIGINS });

/* ---------------- helpers ---------------- */

function json(status: number, body: unknown, extraHeaders?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try { return await req.json(); } catch { return {}; }
}

function str(x: unknown): string | undefined {
  if (typeof x === "string" && x.trim()) return x.trim();
  return undefined;
}

function num(x: unknown, def: number): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

Deno.serve(handler);