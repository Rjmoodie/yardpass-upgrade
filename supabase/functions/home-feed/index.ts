import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withCORS } from "../_shared/cors.ts";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 60;
const ALLOWED_ORIGINS = [
  "https://app.yardpass.com",
  "https://staging.yardpass.com",
  "http://localhost:5173",
  "https://*.lovable.app",
  "https://*.lovableproject.com",
];

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
}

const handler = withCORS(async (req) => {
  try {
    const isGet = req.method === "GET";
    const payload = isGet
      ? Object.fromEntries(new URL(req.url).searchParams.entries())
      : await safeJson(req);

    const limit = clampNumber(payload.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
    const userIdOverride = str(payload.user_id);
    const cursorInput = payload.cursor ?? {
      ts: payload.cursorTs ?? undefined,
      id: payload.cursorId ?? undefined,
      score: payload.cursorScore ?? undefined,
    };
    const cursor = normalizeCursor(cursorInput);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: authHeader
        ? { headers: { Authorization: authHeader } }
        : undefined,
    });

    const {
      data: { user } = { user: null },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError && userError.message !== "Auth session missing!") {
      console.warn("getUser warning", userError.message);
    }

    const viewerId = user?.id ?? userIdOverride ?? null;

    const rpcArgs = {
      p_user_id: viewerId,
      p_limit: limit + 1,
    };
    if (cursor?.id) rpcArgs.p_cursor_item_id = cursor.id;

    let ranked = [];
    const { data: rankedData, error: rankedError } = await supabase.rpc(
      "get_home_feed_ranked",
      rpcArgs,
    );

    if (!rankedError && Array.isArray(rankedData) && rankedData.length > 0) {
      ranked = rankedData;
    } else {
      if (rankedError) {
        console.warn(
          "get_home_feed_ranked error => falling back to basic:",
          rankedError.message,
        );
      }
      ranked = await fetchFallbackRows({ supabase, limit: limit + 1, cursor });
    }

    let nextCursor = null;
    if (ranked.length > limit) {
      const cursorRow = ranked.pop();
      nextCursor = {
        cursorTs: cursorRow?.sort_ts ?? new Date().toISOString(),
        cursorId: cursorRow?.item_id ?? "",
        cursorScore: cursorRow?.score ?? null,
      };
    }

    const items = await expandRows({ supabase, rows: ranked, viewerId });

    return json(200, { items, nextCursor }, {
      "Cache-Control": "private, max-age=10",
    });
  } catch (err) {
    console.error("home-feed error:", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return json(500, { error: message });
  }
}, { allowOrigins: ALLOWED_ORIGINS });

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";

  // Compute allowed origin (single value)
  const allowOrigin = (() => {
    const match = ALLOWED_ORIGINS.some((allowed) => {
      if (allowed === origin) return true;
      if (allowed.includes("*")) {
        const pattern = allowed.replace(/\./g, "\\.").replace(/\*/g, ".*");
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return false;
    });
    return match ? origin : "*";
  })();

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const res = await handler(req);
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", allowOrigin);
  headers.set("Vary", "Origin");
  return new Response(res.body, { status: res.status, headers });
});

async function expandRows({ supabase, rows, viewerId }) {
  if (!rows.length) return [];

  const eventIds = dedupe(rows.map((r) => r.event_id));
  const postIds = rows.filter((r) => r.item_type === "post").map((r) => r.item_id);

  const [{ data: events, error: eventsError }, postsRes] = await Promise.all([
    supabase
      .from("events")
      .select(`
        id, title, description, cover_image_url, start_at, end_at, venue, city, created_at,
        created_by, owner_context_type, owner_context_id,
        user_profiles!events_created_by_fkey(display_name, social_links),
        organizations!events_owner_context_id_fkey(name)
      `)
      .in("id", eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"]),
    postIds.length
      ? supabase
          .from("event_posts_with_meta")
          .select(
            "id, event_id, text, media_urls, like_count, comment_count, author_user_id, author_name, author_badge_label, created_at"
          )
          .in("id", postIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (eventsError) throw eventsError;

  const posts = postsRes?.data ?? [];

  let sponsorMap = new Map();
  if (eventIds.length) {
    try {
      const { data: sponsorRows, error: sponsorError } = await supabase.rpc(
        "get_active_event_sponsors",
        { p_event_ids: eventIds },
      );
      if (sponsorError) {
        console.warn("get_active_event_sponsors error", sponsorError.message);
      } else if (Array.isArray(sponsorRows)) {
        sponsorMap = new Map(
          sponsorRows.map((row) => [
            row.event_id,
            {
              primary: normalizeSponsor(row.primary_sponsor),
              sponsors: normalizeSponsorList(row.sponsors),
            },
          ]),
        );
      }
    } catch (err) {
      console.warn("get_active_event_sponsors threw", err instanceof Error ? err.message : err);
    }
  }

  let viewerLikes = [];
  if (viewerId && postIds.length) {
    const { data } = await supabase
      .from("event_reactions")
      .select("post_id")
      .eq("user_id", viewerId)
      .eq("kind", "like")
      .in("post_id", postIds)
      .throwOnError(false);
    viewerLikes = data ?? [];
  }

  const likedPostIds = new Set(viewerLikes.map((l) => l.post_id));

  let authorLinksMap = new Map();
  const authorIds = dedupe(posts.map((p) => p.author_user_id).filter(Boolean));
  if (authorIds.length) {
    const { data: authorProfiles, error: authorError } = await supabase
      .from("user_profiles")
      .select("user_id, social_links")
      .in("user_id", authorIds);
    if (authorError) {
      console.warn("user_profiles social_links error", authorError.message);
    } else if (Array.isArray(authorProfiles)) {
      authorLinksMap = new Map(
        authorProfiles.map((profile) => [
          profile.user_id,
          normalizeSocialLinks(profile.social_links),
        ]),
      );
    }
  }

  const eMap = new Map((events ?? []).map((e) => [e.id, e]));
  const pMap = new Map(posts.map((p) => [p.id, p]));

  return rows
    .map((row) => {
      const ev = eMap.get(row.event_id);
      if (!ev) return null;

      const sponsorEntry = sponsorMap.get(row.event_id);
      const primarySponsor = sponsorEntry?.primary ?? null;
      const sponsorList = sponsorEntry?.sponsors ?? null;

      const organizerName = ev?.owner_context_type === "organization"
        ? ev?.organizations?.name ?? "Organizer"
        : ev?.user_profiles?.display_name ?? "Organizer";
      const organizerId = ev?.owner_context_type === "organization"
        ? ev?.owner_context_id ?? null
        : ev?.created_by ?? null;
      const location = [ev?.venue, ev?.city].filter(Boolean).join(", ") || "TBA";
      const sortTs = row.sort_ts ?? ev?.start_at ?? ev?.created_at ?? new Date().toISOString();

      if (row.item_type === "event") {
        return {
          item_type: "event",
          sort_ts: sortTs,
          item_id: row.item_id,
          event_id: row.event_id,
          event_title: ev?.title ?? "Event",
          event_description: ev?.description ?? "",
          event_starts_at: ev?.start_at ?? null,
          event_cover_image: ev?.cover_image_url ?? "",
          event_organizer: organizerName,
          event_organizer_id: organizerId,
          event_owner_context_type: ev?.owner_context_type ?? "individual",
          event_location: location,
          author_id: null,
          author_name: null,
          author_badge: null,
          author_social_links: null,
          media_urls: null,
          content: null,
          metrics: {
            likes: 0,
            comments: 0,
            viewer_has_liked: false,
            score: row.score ?? null,
          },
          sponsor: primarySponsor,
          sponsors: sponsorList,
        };
      }

      const post = pMap.get(row.item_id);
      if (!post) return null;

      const socialLinks = authorLinksMap.get(post.author_user_id) ?? null;

      return {
        item_type: "post",
        sort_ts: sortTs,
        item_id: row.item_id,
        event_id: row.event_id,
        event_title: ev?.title ?? "Event",
        event_description: ev?.description ?? "",
        event_starts_at: ev?.start_at ?? null,
        event_cover_image: ev?.cover_image_url ?? "",
        event_organizer: organizerName,
        event_organizer_id: organizerId,
        event_owner_context_type: ev?.owner_context_type ?? "individual",
        event_location: location,
        author_id: post.author_user_id ?? null,
        author_name: post.author_name ?? null,
        author_badge: post.author_badge_label ?? null,
        author_social_links: socialLinks,
        media_urls: Array.isArray(post.media_urls) ? post.media_urls.filter(Boolean) : [],
        content: post.text ?? "",
        metrics: {
          likes: post.like_count ?? 0,
          comments: post.comment_count ?? 0,
          viewer_has_liked: likedPostIds.has(row.item_id),
          score: row.score ?? null,
        },
        sponsor: null,
        sponsors: null,
      };
    })
    .filter(Boolean);
}

async function fetchFallbackRows({ supabase, limit, cursor }) {
  const query = supabase
    .from("events")
    .select("id, start_at")
    .eq("visibility", "public")
    .gte("start_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order("start_at", { ascending: false })
    .limit(limit);

  if (cursor?.ts) {
    query.lt("start_at", cursor.ts);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((event) => ({
    item_type: "event",
    item_id: event.id,
    event_id: event.id,
    score: 0.1,
    sort_ts: event.start_at ?? new Date().toISOString(),
  }));
}

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

async function safeJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function str(x) {
  if (typeof x === "string" && x.trim()) return x.trim();
  return undefined;
}

function clampNumber(x, fallback, min, max) {
  const n = Number(x);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function dedupe(arr) {
  return Array.from(new Set(arr));
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tryJsonParse(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeSponsor(value) {
  const input = tryJsonParse(value);
  if (!isRecord(input)) return null;

  const name = str(input.name);
  if (!name) return null;

  const normalized = {
    name,
    amount_cents: Number.isFinite(Number(input.amount_cents))
      ? Math.max(0, Math.round(Number(input.amount_cents)))
      : 0,
  };

  const logo = str(input.logo_url);
  if (logo) normalized.logo_url = logo;

  const tier = str(input.tier);
  if (tier) normalized.tier = tier;

  return normalized;
}

function normalizeSponsorList(value) {
  const input = tryJsonParse(value);
  if (!Array.isArray(input)) return null;
  const sponsors = input
    .map((entry) => normalizeSponsor(entry))
    .filter(Boolean);
  return sponsors.length ? sponsors : null;
}

function normalizeSocialLinks(value) {
  const input = tryJsonParse(value);
  if (!Array.isArray(input)) return null;
  const links = input.filter((entry) => isRecord(entry) && Object.keys(entry).length > 0);
  return links.length ? links : null;
}

function normalizeCursor(cursor) {
  if (!cursor) return null;
  const ts = typeof cursor.ts === "string" && cursor.ts ? cursor.ts : undefined;
  const id = typeof cursor.id === "string" && cursor.id ? cursor.id : undefined;
  const score = typeof cursor.score === "number" && Number.isFinite(cursor.score)
    ? cursor.score
    : undefined;
  if (!ts && !id && score == null) return null;
  return { ts, id, score };
}
